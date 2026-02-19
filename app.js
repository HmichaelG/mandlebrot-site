// Constants
const MIN_DRAG_THRESHOLD = 5;

// Main application state
const state = {
    canvas: null,
    ctx: null,
    worker: null,
    zoomHistory: [],
    currentView: {
        realMin: -2.5,
        realMax: 1.0,
        imagMin: -1.2,
        imagMax: 1.2
    },
    maxIterations: 256,
    isRendering: false,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragEnd: { x: 0, y: 0 }
};

// Create inline worker to avoid CORS issues with file:// protocol
function createInlineWorker() {
    const workerCode = `
        // Web Worker for computing Mandelbrot set
        const ESCAPE_RADIUS_SQUARED = 4;
        
        self.onmessage = function(e) {
            const { width, height, realMin, realMax, imagMin, imagMax, maxIterations } = e.data;
            
            const pixels = new Uint8ClampedArray(width * height * 4);
            
            // Pre-calculate ranges
            const realRange = realMax - realMin;
            const imagRange = imagMax - imagMin;
            
            // Compute Mandelbrot set
            for (let py = 0; py < height; py++) {
                for (let px = 0; px < width; px++) {
                    // Map pixel to complex plane
                    const x0 = realMin + (px / width) * realRange;
                    const y0 = imagMin + (py / height) * imagRange;
                    
                    // Iterate Mandelbrot equation: z = z^2 + c
                    let x = 0;
                    let y = 0;
                    let iteration = 0;
                    
                    while (x * x + y * y <= ESCAPE_RADIUS_SQUARED && iteration < maxIterations) {
                        const xtemp = x * x - y * y + x0;
                        y = 2 * x * y + y0;
                        x = xtemp;
                        iteration++;
                    }
                    
                    // Calculate pixel index
                    const pixelIndex = (py * width + px) * 4;
                    
                    // Color mapping
                    if (iteration === maxIterations) {
                        // Inside the set - black
                        pixels[pixelIndex] = 0;
                        pixels[pixelIndex + 1] = 0;
                        pixels[pixelIndex + 2] = 0;
                        pixels[pixelIndex + 3] = 255;
                    } else {
                        // Outside the set - colorful gradient
                        // Smooth coloring using continuous potential
                        const zn = Math.sqrt(x * x + y * y);
                        const nu = Math.log(Math.log(zn) / Math.log(2)) / Math.log(2);
                        const smoothIter = iteration + 1 - nu;
                        
                        // Create a smooth color palette
                        const t = smoothIter / maxIterations;
                        const color = getColor(t);
                        
                        pixels[pixelIndex] = color.r;
                        pixels[pixelIndex + 1] = color.g;
                        pixels[pixelIndex + 2] = color.b;
                        pixels[pixelIndex + 3] = 255;
                    }
                }
            }
            
            // Send result back to main thread
            self.postMessage({
                pixels: pixels.buffer,
                width: width,
                height: height
            }, [pixels.buffer]);
        };
        
        // Color palette function - creates a smooth rainbow-like gradient
        function getColor(t) {
            // Ensure t is in [0, 1]
            t = Math.max(0, Math.min(1, t));
            
            // Multi-stage color gradient for better visual appeal
            if (t < 0.16) {
                // Dark blue to cyan
                const s = t / 0.16;
                return {
                    r: 0,
                    g: Math.floor(7 * (1 - s) + 135 * s),
                    b: Math.floor(100 * (1 - s) + 255 * s)
                };
            } else if (t < 0.42) {
                // Cyan to green
                const s = (t - 0.16) / 0.26;
                return {
                    r: Math.floor(0 * (1 - s) + 50 * s),
                    g: Math.floor(135 * (1 - s) + 220 * s),
                    b: Math.floor(255 * (1 - s) + 50 * s)
                };
            } else if (t < 0.6425) {
                // Green to yellow
                const s = (t - 0.42) / 0.2225;
                return {
                    r: Math.floor(50 * (1 - s) + 255 * s),
                    g: Math.floor(220 * (1 - s) + 255 * s),
                    b: Math.floor(50 * (1 - s))
                };
            } else if (t < 0.8575) {
                // Yellow to orange
                const s = (t - 0.6425) / 0.215;
                return {
                    r: 255,
                    g: Math.floor(255 * (1 - s) + 165 * s),
                    b: 0
                };
            } else {
                // Orange to red to dark red
                const s = (t - 0.8575) / 0.1425;
                return {
                    r: Math.floor(255 * (1 - s) + 139 * s),
                    g: Math.floor(165 * (1 - s) + 0 * s),
                    b: Math.floor(0)
                };
            }
        }
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    return new Worker(workerUrl);
}

// Initialize the application
function init() {
    state.canvas = document.getElementById('mandelbrotCanvas');
    state.ctx = state.canvas.getContext('2d');
    
    // Set up canvas size
    resizeCanvas();
    window.addEventListener('resize', debounce(handleResize, 250));
    
    // Set up controls
    document.getElementById('resetBtn').addEventListener('click', resetView);
    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('maxIterations').addEventListener('input', handleIterationChange);
    
    // Set up mouse events for rectangle selection
    state.canvas.addEventListener('mousedown', handleMouseDown);
    state.canvas.addEventListener('mousemove', handleMouseMove);
    state.canvas.addEventListener('mouseup', handleMouseUp);
    state.canvas.addEventListener('mouseleave', handleMouseLeave);
    
    // Touch support
    state.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    state.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    state.canvas.addEventListener('touchend', handleTouchEnd);
    
    // Initialize Web Worker
    // Use inline worker to avoid CORS issues when opening from file://
    state.worker = createInlineWorker();
    state.worker.onmessage = handleWorkerMessage;
    
    // Initial render
    render();
}

// Resize canvas to fit container while maintaining aspect ratio
function resizeCanvas() {
    const wrapper = document.querySelector('.canvas-wrapper');
    const rect = wrapper.getBoundingClientRect();
    
    // Make canvas slightly smaller than wrapper to account for padding
    const maxWidth = rect.width - 40;
    const maxHeight = rect.height - 40;
    
    // Maintain a reasonable aspect ratio
    const aspectRatio = 1.5; // width / height
    let width, height;
    
    if (maxWidth / maxHeight > aspectRatio) {
        height = maxHeight;
        width = height * aspectRatio;
    } else {
        width = maxWidth;
        height = width / aspectRatio;
    }
    
    state.canvas.width = Math.floor(width);
    state.canvas.height = Math.floor(height);
}

function handleResize() {
    resizeCanvas();
    render();
}

// Render the Mandelbrot set
function render() {
    if (state.isRendering) return;
    
    state.isRendering = true;
    showLoading(true);
    updateCoordinateDisplay();
    
    const imageData = state.ctx.createImageData(state.canvas.width, state.canvas.height);
    
    state.worker.postMessage({
        width: state.canvas.width,
        height: state.canvas.height,
        realMin: state.currentView.realMin,
        realMax: state.currentView.realMax,
        imagMin: state.currentView.imagMin,
        imagMax: state.currentView.imagMax,
        maxIterations: state.maxIterations
    });
}

// Handle worker response
function handleWorkerMessage(e) {
    const imageData = new ImageData(
        new Uint8ClampedArray(e.data.pixels),
        e.data.width,
        e.data.height
    );
    
    state.ctx.putImageData(imageData, 0, 0);
    state.isRendering = false;
    showLoading(false);
}

// Mouse event handlers
function handleMouseDown(e) {
    if (state.isRendering) return;
    
    const rect = state.canvas.getBoundingClientRect();
    state.isDragging = true;
    state.dragStart = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    state.dragEnd = { ...state.dragStart };
}

function handleMouseMove(e) {
    // Update cursor coordinates
    const rect = state.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    if (canvasX >= 0 && canvasX <= state.canvas.width && canvasY >= 0 && canvasY <= state.canvas.height) {
        const complex = canvasToComplex(canvasX, canvasY);
        document.getElementById('cursorCoords').textContent = 
            `${complex.real.toFixed(6)} + ${complex.imag.toFixed(6)}i`;
    }
    
    if (!state.isDragging) return;
    
    state.dragEnd = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    
    drawSelectionRect();
}

function handleMouseUp(e) {
    if (!state.isDragging) return;
    
    state.isDragging = false;
    hideSelectionRect();
    
    const rect = state.canvas.getBoundingClientRect();
    state.dragEnd = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    
    // Check if drag was significant enough
    const dx = Math.abs(state.dragEnd.x - state.dragStart.x);
    const dy = Math.abs(state.dragEnd.y - state.dragStart.y);
    
    if (dx > MIN_DRAG_THRESHOLD && dy > MIN_DRAG_THRESHOLD) {
        zoomToSelection();
    }
}

function handleMouseLeave() {
    if (state.isDragging) {
        state.isDragging = false;
        hideSelectionRect();
    }
    document.getElementById('cursorCoords').textContent = '-';
}

// Touch event handlers
function handleTouchStart(e) {
    e.preventDefault();
    if (state.isRendering || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const rect = state.canvas.getBoundingClientRect();
    state.isDragging = true;
    state.dragStart = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
    };
    state.dragEnd = { ...state.dragStart };
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!state.isDragging || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const rect = state.canvas.getBoundingClientRect();
    state.dragEnd = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
    };
    
    drawSelectionRect();
}

function handleTouchEnd(e) {
    e.preventDefault();
    if (!state.isDragging) return;
    
    state.isDragging = false;
    hideSelectionRect();
    
    const dx = Math.abs(state.dragEnd.x - state.dragStart.x);
    const dy = Math.abs(state.dragEnd.y - state.dragStart.y);
    
    if (dx > MIN_DRAG_THRESHOLD && dy > MIN_DRAG_THRESHOLD) {
        zoomToSelection();
    }
}

// Draw selection rectangle
function drawSelectionRect() {
    const selectionRect = document.getElementById('selectionRect');
    
    // Calculate corrected rectangle maintaining canvas aspect ratio
    let x1 = Math.min(state.dragStart.x, state.dragEnd.x);
    let y1 = Math.min(state.dragStart.y, state.dragEnd.y);
    let x2 = Math.max(state.dragStart.x, state.dragEnd.x);
    let y2 = Math.max(state.dragStart.y, state.dragEnd.y);
    
    let width = x2 - x1;
    let height = y2 - y1;
    
    // Adjust to match canvas aspect ratio
    const canvasAspect = state.canvas.width / state.canvas.height;
    const selectionAspect = width / height;
    
    if (selectionAspect > canvasAspect) {
        // Too wide, adjust height
        height = width / canvasAspect;
        if (state.dragEnd.y < state.dragStart.y) {
            y1 = state.dragStart.y - height;
        }
    } else {
        // Too tall, adjust width
        width = height * canvasAspect;
        if (state.dragEnd.x < state.dragStart.x) {
            x1 = state.dragStart.x - width;
        }
    }
    
    // Clamp to canvas bounds
    x1 = Math.max(0, Math.min(x1, state.canvas.width));
    y1 = Math.max(0, Math.min(y1, state.canvas.height));
    width = Math.min(width, state.canvas.width - x1);
    height = Math.min(height, state.canvas.height - y1);
    
    const canvasRect = state.canvas.getBoundingClientRect();
    selectionRect.style.left = (canvasRect.left + x1) + 'px';
    selectionRect.style.top = (canvasRect.top + y1) + 'px';
    selectionRect.style.width = width + 'px';
    selectionRect.style.height = height + 'px';
    selectionRect.style.display = 'block';
}

function hideSelectionRect() {
    document.getElementById('selectionRect').style.display = 'none';
}

// Zoom to selected region
function zoomToSelection() {
    // Calculate corrected rectangle
    let x1 = Math.min(state.dragStart.x, state.dragEnd.x);
    let y1 = Math.min(state.dragStart.y, state.dragEnd.y);
    let x2 = Math.max(state.dragStart.x, state.dragEnd.x);
    let y2 = Math.max(state.dragStart.y, state.dragEnd.y);
    
    let width = x2 - x1;
    let height = y2 - y1;
    
    // Adjust to match canvas aspect ratio
    const canvasAspect = state.canvas.width / state.canvas.height;
    const selectionAspect = width / height;
    
    if (selectionAspect > canvasAspect) {
        height = width / canvasAspect;
        if (state.dragEnd.y < state.dragStart.y) {
            y1 = state.dragStart.y - height;
        }
    } else {
        width = height * canvasAspect;
        if (state.dragEnd.x < state.dragStart.x) {
            x1 = state.dragStart.x - width;
        }
    }
    
    // Convert to complex coordinates
    const topLeft = canvasToComplex(x1, y1);
    const bottomRight = canvasToComplex(x1 + width, y1 + height);
    
    // Save current view to history
    state.zoomHistory.push({ ...state.currentView });
    document.getElementById('backBtn').disabled = false;
    
    // Update view
    state.currentView = {
        realMin: topLeft.real,
        realMax: bottomRight.real,
        imagMin: topLeft.imag,
        imagMax: bottomRight.imag
    };
    
    render();
}

// Convert canvas coordinates to complex plane coordinates
function canvasToComplex(x, y) {
    const real = state.currentView.realMin + 
        (x / state.canvas.width) * (state.currentView.realMax - state.currentView.realMin);
    const imag = state.currentView.imagMin + 
        (y / state.canvas.height) * (state.currentView.imagMax - state.currentView.imagMin);
    
    return { real, imag };
}

// Navigation functions
function resetView() {
    state.zoomHistory = [];
    state.currentView = {
        realMin: -2.5,
        realMax: 1.0,
        imagMin: -1.2,
        imagMax: 1.2
    };
    document.getElementById('backBtn').disabled = true;
    render();
}

function goBack() {
    if (state.zoomHistory.length === 0) return;
    
    state.currentView = state.zoomHistory.pop();
    
    if (state.zoomHistory.length === 0) {
        document.getElementById('backBtn').disabled = true;
    }
    
    render();
}

function handleIterationChange(e) {
    state.maxIterations = parseInt(e.target.value);
    document.getElementById('iterationValue').textContent = state.maxIterations;
    render();
}

// UI updates
function updateCoordinateDisplay() {
    document.getElementById('realRange').textContent = 
        `[${state.currentView.realMin.toFixed(6)}, ${state.currentView.realMax.toFixed(6)}]`;
    document.getElementById('imagRange').textContent = 
        `[${state.currentView.imagMin.toFixed(6)}, ${state.currentView.imagMax.toFixed(6)}]`;
}

function showLoading(show) {
    const indicator = document.getElementById('loadingIndicator');
    if (show) {
        indicator.classList.add('active');
    } else {
        indicator.classList.remove('active');
    }
}

// Utility: debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
