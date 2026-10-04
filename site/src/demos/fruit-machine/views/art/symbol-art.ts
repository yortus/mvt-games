import { PICTURE_KINDS, type SymbolKind } from '../../data';
import { svgFor } from './symbol-svgs';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The symbols' pictures, drawn once at load, for every view to share. The
 * canvases are renderer-neutral: the Pixi views make textures of them, and the
 * three.js views wrap them round the drums, so both draw the same pixels.
 */
export interface SymbolArt {
    /** A symbol's picture, sharp. */
    canvasFor: (kind: SymbolKind) => HTMLCanvasElement;
    /** A symbol's picture smeared up and down, for a reel turning too fast to read. */
    blurredCanvasFor: (kind: SymbolKind) => HTMLCanvasElement;
    /** A symbol's picture as an SVG data URL, for an `<img>`. */
    urlFor: (kind: SymbolKind) => string;
}

export interface LoadSymbolArtOptions {
    /** Pixels along each side of a symbol's canvas. Defaults to 256. */
    readonly size?: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/** Draws every symbol's SVG to canvases, once the browser has decoded them. */
export async function loadSymbolArt(options: LoadSymbolArtOptions = {}): Promise<SymbolArt> {
    const { size = 256 } = options;
    const kinds: readonly SymbolKind[] = [...PICTURE_KINDS, 'wild'];
    const urls = {} as Record<SymbolKind, string>;
    const sharp = {} as Record<SymbolKind, HTMLCanvasElement>;
    const blurred = {} as Record<SymbolKind, HTMLCanvasElement>;

    await Promise.all(kinds.map(async (kind) => {
        urls[kind] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgFor(kind))}`;
        const image = new Image(size, size);
        image.src = urls[kind];
        await image.decode();
        sharp[kind] = drawSharp(image, size);
        blurred[kind] = drawBlurred(image, size);
    }));

    return {
        canvasFor: (kind) => sharp[kind],
        blurredCanvasFor: (kind) => blurred[kind],
        urlFor: (kind) => urls[kind],
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far, as a fraction of a symbol's height, the motion blur smears it each way. */
const BLUR_REACH = 0.12;
const BLUR_COPIES = 9;

function drawSharp(image: HTMLImageElement, size: number): HTMLCanvasElement {
    const canvas = createCanvas(size, size);
    canvas.getContext('2d')!.drawImage(image, 0, 0, size, size);
    return canvas;
}

/**
 * Copies of the picture, faint and offset up and down, built up into a
 * vertical smear. Drawn by hand rather than with a canvas `filter`, which not
 * every browser supports.
 */
function drawBlurred(image: HTMLImageElement, size: number): HTMLCanvasElement {
    const canvas = createCanvas(size, size);
    const context = canvas.getContext('2d')!;
    const reach = size * BLUR_REACH;
    context.globalAlpha = 2.5 / BLUR_COPIES;
    for (let i = 0; i < BLUR_COPIES; i++) {
        const offset = -reach + (2 * reach * i) / (BLUR_COPIES - 1);
        context.drawImage(image, 0, offset, size, size);
    }
    return canvas;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}
