import { COLOUR_CYCLE, RAMPS } from '../../data';
import type { RasterBars } from '../../models';
import { bitmapIndex, COLUMNS, DISPLAY_TOP, FRAME_HEIGHT, ROWS, type VirtualChip } from '../chip';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Writes `text` into screen memory at a row and column, in a colour,
 * clipped to the screen. Only the first `length` characters, if given.
 * Lowercase is drawn as capitals.
 */
export function writeText(
    chip: VirtualChip, row: number, col: number, text: string, colour: number, length = text.length,
): void {
    if (row < 0 || row >= ROWS) return;
    for (let i = 0; i < length; i++) {
        const c = col + i;
        if (c < 0 || c >= COLUMNS) continue;
        let code = text.charCodeAt(i);
        if (code >= 97 && code <= 122) code -= 32;
        chip.screen[row * COLUMNS + c] = code;
        chip.colour[row * COLUMNS + c] = colour;
    }
}

/** The column that centres `text` on the screen. */
export function centredCol(text: string): number {
    return (COLUMNS - text.length) >> 1;
}

/**
 * Writes `text` centred on a row, colour-washed: each character a step
 * further along the colour cycle, the whole moved on by `washPhase` steps.
 */
export function writeWashed(chip: VirtualChip, row: number, text: string, washPhase: number): void {
    const col = centredCol(text);
    writeText(chip, row, col, text, 0);
    const shift = Math.floor(washPhase);
    for (let i = 0; i < text.length; i++) {
        chip.colour[row * COLUMNS + col + i] = COLOUR_CYCLE[(i + shift) % COLOUR_CYCLE.length];
    }
}

/**
 * Draws raster bars by rewriting the background colour, and the border's
 * too if `isFullWidth`, line by line down each bar's colour ramp. Later bars
 * pass in front of earlier ones.
 */
export function paintRasterBars(chip: VirtualChip, bars: RasterBars, isFullWidth: boolean): void {
    for (let i = 0; i < bars.barCount; i++) {
        const ramp = RAMPS[bars.barRampAt(i)];
        const top = Math.round(DISPLAY_TOP + bars.barRowAt(i) * 8) - (ramp.length >> 1);
        for (let k = 0; k < ramp.length; k++) {
            const line = top + k;
            if (line < 0 || line >= FRAME_HEIGHT) continue;
            chip.background[line] = ramp[k];
            if (isFullWidth) chip.border[line] = ramp[k];
        }
    }
}

/**
 * Sets one pixel of a multicolour bitmap, at multicolour pixel `x` (0-159)
 * and display line `y` (0-199), to a bit pair (0-3).
 */
export function plotMulticolour(chip: VirtualChip, x: number, y: number, value: number): void {
    const index = bitmapIndex(x >> 2, y);
    const shift = 6 - (x & 3) * 2;
    chip.bitmap[index] = (chip.bitmap[index] & ~(3 << shift)) | (value << shift);
}
