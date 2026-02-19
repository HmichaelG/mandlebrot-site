# Mandelbrot Set Explorer

An interactive website for exploring the beautiful fractal patterns of the Mandelbrot set. Features intuitive rectangle-select zooming, smooth coloring, and responsive design.

![Mandelbrot Set](https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Mandel_zoom_00_mandelbrot_set.jpg/320px-Mandel_zoom_00_mandelbrot_set.jpg)

## Features

- **Interactive Rectangle Zoom**: Click and drag to select any region and zoom in
- **Smooth Coloring**: Beautiful gradient color palette with smooth transitions
- **Web Workers**: Off-thread computation keeps the UI responsive
- **Navigation Controls**: 
  - Reset button to return to the full view
  - Back button to undo zoom operations
  - Adjustable iteration count (50-1000) for detail control
- **Real-time Coordinates**: View complex plane coordinates and cursor position
- **Responsive Design**: Works on desktop and mobile devices
- **Touch Support**: Works with touch gestures on mobile devices
- **No Dependencies**: Pure vanilla JavaScript - no frameworks or build tools required

## How to Run

Simply open `index.html` in any modern web browser. That's it! No server, no npm install, no build step required.

You can:
- Double-click `index.html` in your file explorer
- Or open it from your browser: File → Open → select `index.html`
- Or run a local server if you prefer:
  ```bash
  python -m http.server 8000
  # Then open http://localhost:8000
  ```

## How to Use

### Zooming
1. **Click and drag** on the canvas to draw a selection rectangle
2. **Release** to zoom into the selected region
3. The selection automatically adjusts to maintain the correct aspect ratio

### Navigation
- **🏠 Reset**: Return to the default full view of the Mandelbrot set
- **↶ Back**: Go back to the previous zoom level (undo)
- **Max Iterations Slider**: Adjust the detail level (higher = more detail but slower)

### Exploring
- The **cursor coordinates** display shows the current position in the complex plane
- The **coordinate ranges** show the current view bounds
- Try zooming into the boundary between the black interior and colored exterior for interesting patterns
- Increase max iterations when you zoom deep for better detail

## Technical Details

### The Mandelbrot Set

The Mandelbrot set is defined as the set of complex numbers `c` for which the iterative formula:

```
z(n+1) = z(n)² + c
```

starting with `z(0) = 0`, does not diverge (i.e., remains bounded).

### Implementation

- **index.html**: Main HTML structure with canvas and controls
- **style.css**: Styling for the UI, controls, and selection rectangle
- **app.js**: Main application logic including:
  - Canvas management and resizing
  - Mouse/touch event handling for rectangle selection
  - Zoom history stack
  - Coordinate transformations
  - UI control handlers
- **worker.js**: Web Worker that computes the Mandelbrot set:
  - Performs iteration calculations off the main thread
  - Uses smooth coloring algorithm for prettier visuals
  - Returns pixel data to be rendered on canvas

### Color Scheme

The color palette uses a multi-stage gradient that transitions through:
- Dark blue → Cyan → Green → Yellow → Orange → Red → Dark red

Points inside the Mandelbrot set (that don't escape) are rendered in black.

### Performance

- Web Workers ensure the UI remains responsive during computation
- The canvas automatically adjusts to window size while maintaining aspect ratio
- Loading indicator shows progress during rendering
- Debounced resize events prevent excessive re-rendering

## Browser Compatibility

Works in all modern browsers that support:
- HTML5 Canvas
- Web Workers
- ES6 JavaScript

Tested in Chrome, Firefox, Safari, and Edge.

## Interesting Regions to Explore

Try zooming into these interesting areas:

1. **Seahorse Valley**: Around `-0.75 + 0.1i`
2. **Elephant Valley**: Around `0.3 + 0.0i`
3. **Spiral**: Around `-0.7269 + 0.1889i`
4. **Mini Mandelbrot**: Around `-0.16 + 1.0405i`

Simply click and drag around these coordinate regions and explore!

## License

This project is open source and available for educational and personal use.