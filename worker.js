// Web Worker for computing Mandelbrot set
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
            
            while (x * x + y * y <= 4 && iteration < maxIterations) {
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
            r: Math.floor(0 * (1 - s) + 0 * s),
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
            b: Math.floor(50 * (1 - s) + 0 * s)
        };
    } else if (t < 0.8575) {
        // Yellow to orange
        const s = (t - 0.6425) / 0.215;
        return {
            r: Math.floor(255),
            g: Math.floor(255 * (1 - s) + 165 * s),
            b: Math.floor(0)
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
