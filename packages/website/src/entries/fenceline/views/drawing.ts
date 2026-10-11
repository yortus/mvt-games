import type { Graphics } from 'pixi.js';

// Helpers for drawing the game's pixel art with Graphics.

/** A pixel-art sprite: rectangles of colour, each [x, y, width, height, colour], from its origin. */
export type PixelRects = readonly (readonly [number, number, number, number, number])[];

/** Draws `rects` into `g`, offset by (x, y). */
export function drawPixels(g: Graphics, rects: PixelRects, x = 0, y = 0): Graphics {
    for (let i = 0; i < rects.length; i++) {
        const [rx, ry, width, height, colour] = rects[i];
        g.rect(x + rx, y + ry, width, height).fill(colour);
    }
    return g;
}

/**
 * Draws `rects` into `g` with a one-pixel outline of `outline` round the
 * whole shape, so it stands out from any ground.
 */
export function drawOutlinedPixels(g: Graphics, rects: PixelRects, outline: number): Graphics {
    for (let i = 0; i < OUTLINE_OFFSETS.length; i++) {
        const [dx, dy] = OUTLINE_OFFSETS[i];
        for (let j = 0; j < rects.length; j++) {
            const [rx, ry, width, height] = rects[j];
            g.rect(rx + dx, ry + dy, width, height).fill(outline);
        }
    }
    return drawPixels(g, rects);
}

/**
 * A small whole number made from a cell's position, the same each time. It
 * places the grass, flowers and ripples, so they stay put when the meadow is
 * redrawn.
 */
export function hashCell(row: number, col: number): number {
    let h = Math.imul(row, 0x27d4eb2d) ^ Math.imul(col, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    return (h ^ (h >>> 13)) >>> 0;
}

/** The four ways an outline is drawn out from a shape, one pixel each. */
const OUTLINE_OFFSETS: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
