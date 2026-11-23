import { Texture } from 'pixi.js';
import { createRandom } from '@mvtjs/site-kit/random';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FloorTextureOptions {
    /** The floor's size, in metres. The planks run along its length. */
    readonly length: number;
    readonly width: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the gallery's floor, drawn on a canvas. It's pale oak boards, laid
 * end to end in rows. Each board is a slightly different shade, with a fine
 * grain and a thin dark seam round it. One picture covers the whole floor,
 * so it doesn't repeat. It's drawn from a fixed seed, so it's the same
 * every time.
 */
export function createFloorTexture({ length, width }: FloorTextureOptions): Texture {
    const canvasWidth = PIXELS_ACROSS;
    const pixelsPerMetre = canvasWidth / length;
    const canvasHeight = Math.round(width * pixelsPerMetre);
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('gallery: the floor needs a 2D canvas');
    const random = createRandom({ seed: 1863 });
    const boardWidth = BOARD_WIDTH * pixelsPerMetre;
    const rowCount = Math.ceil(canvasHeight / boardWidth);
    for (let row = 0; row < rowCount; row++) {
        const y = row * boardWidth;
        // Each row's joints fall in different places, as boards are laid
        let x = -random.between(0, BOARD_MAX_LENGTH * pixelsPerMetre);
        while (x < canvasWidth) {
            const boardLength = random.between(BOARD_MIN_LENGTH, BOARD_MAX_LENGTH) * pixelsPerMetre;
            drawBoard(context, random.between(-1, 1), x, y, boardLength, boardWidth, random.next);
            x += boardLength;
        }
    }
    return Texture.from(canvas);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many pixels the picture is across the floor's length. */
const PIXELS_ACROSS = 2048;
/** A board's width, and how long boards are, in metres. */
const BOARD_WIDTH = 0.18;
const BOARD_MIN_LENGTH = 1.2;
const BOARD_MAX_LENGTH = 2.6;
/** Pale oak, which each board's shade varies from. */
const OAK = { r: 214, g: 184, b: 142 };

/** Draws one board, `shade` from -1 (darker) to 1 (lighter), with its grain and its seam. */
function drawBoard(context: CanvasRenderingContext2D, shade: number, x: number, y: number, boardLength: number, boardWidth: number, next: () => number): void {
    const lift = shade * 14;
    context.fillStyle = `rgb(${OAK.r + lift}, ${OAK.g + lift}, ${OAK.b + lift * 0.8})`;
    context.fillRect(x, y, boardLength, boardWidth);
    // The grain: long, faint lines along the board
    context.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const lineY = y + next() * boardWidth;
        context.strokeStyle = `rgba(120, 82, 46, ${0.08 + next() * 0.1})`;
        context.beginPath();
        context.moveTo(x, lineY);
        context.bezierCurveTo(x + boardLength * 0.3, lineY + (next() - 0.5) * 4, x + boardLength * 0.7, lineY + (next() - 0.5) * 4, x + boardLength, lineY);
        context.stroke();
    }
    context.strokeStyle = 'rgba(90, 62, 36, 0.55)';
    context.strokeRect(x + 0.5, y + 0.5, boardLength - 1, boardWidth - 1);
}
