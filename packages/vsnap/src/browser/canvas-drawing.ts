import { fitImage, flipRows } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** An image of a view, drawn on a canvas. */
export interface CanvasImage {
    readonly width: number;
    readonly height: number;
    /** The pixels, as RGBA, with rows from the top. */
    readonly pixels: Uint8Array;
    /** Image pixels per view pixel. This is 1, or less for a view drawn smaller to fit the size budget. */
    readonly resolution: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Returns whether a value that a pose returned is a canvas. */
export function isCanvas(value: unknown): value is HTMLCanvasElement | OffscreenCanvas {
    return value instanceof HTMLCanvasElement || value instanceof OffscreenCanvas;
}

/**
 * Reads the pixels of a canvas, as an image at full resolution. A 2D canvas
 * is read as it is. A WebGL canvas is read from its drawing buffer, which
 * the browser clears once the canvas is shown on the page. So a WebGL
 * canvas in the page needs `preserveDrawingBuffer: true`, unless it is read
 * straight after drawing. A kind of view whose `draw` renders on a canvas
 * can return the canvas, and vsnap reads it with this. A kind that drew it
 * smaller to fit the size budget reads it itself, and gives the image its
 * resolution.
 */
export function readCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasImage {
    const { width, height } = canvas;
    // Asking for a context of another kind than the canvas has returns null.
    // Asking a canvas that has no context yet makes one, which is blank.
    const context = canvas.getContext('2d') ?? canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (context === null) throw new Error('The canvas is neither a 2D canvas nor a WebGL canvas, so it can\'t be read.');
    if ('getImageData' in context) {
        const data = context.getImageData(0, 0, width, height).data;
        return { width, height, pixels: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), resolution: 1 };
    }
    const gl = context as WebGLRenderingContext | WebGL2RenderingContext;
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, CANVAS_FRAMEBUFFER);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    flipRows(pixels, gl.drawingBufferWidth, gl.drawingBufferHeight);
    return { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, pixels, resolution: 1 };
}

/** Throws if a canvas, which is read at the size it was drawn, is over the size budget. */
export function checkCanvasBudget(canvas: HTMLCanvasElement | OffscreenCanvas, maxPixels: number): void {
    const fit = fitImage({
        width: canvas.width, height: canvas.height, maxPixels, canScale: false,
        advice: 'A canvas is read at the size it was drawn, so draw a smaller canvas, or draw part of the view.',
    });
    if ('problem' in fit) throw new Error(fit.problem);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// eslint-disable-next-line @mvtjs/no-null -- WebGL binds the canvas's own framebuffer when given `null`
const CANVAS_FRAMEBUFFER = null;
