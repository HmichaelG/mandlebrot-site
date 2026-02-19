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
    state.worker = new Worker('worker.js');
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
