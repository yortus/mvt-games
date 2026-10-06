import { COLOUR_CYCLE, CREDITS } from '../../data';
import type { CreditsModel } from '../../models';
import { COLUMNS, DISPLAY_HEIGHT, DISPLAY_TOP, ROWS, type VirtualChip } from '../chip';
import { centredCol, writeText } from './paint-helpers';

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------

/**
 * Part 6. A smooth upscroller: whole rows by rewriting screen memory, the
 * last few pixels by showing each frame line a few display lines further
 * down. Every character is coloured by a diagonal wash through the colour
 * cycle, moving across the text.
 */
export function paintCredits(chip: VirtualChip, credits: CreditsModel): void {
    const scroll = credits.scrollRows;
    const firstLine = Math.floor(scroll);
    const finePixels = Math.floor((scroll - firstLine) * 8);
    const shift = Math.floor(credits.washPhase);

    for (let row = 0; row < ROWS; row++) {
        const n = firstLine + row;
        if (n < 0 || n >= CREDITS.length) continue;
        const text = CREDITS[n];
        const col = centredCol(text);
        writeText(chip, row, col, text, 0);
        for (let i = 0; i < text.length; i++) {
            const step = (col + i + n * 2 - shift) % COLOUR_CYCLE.length;
            chip.colour[row * COLUMNS + col + i] = COLOUR_CYCLE[step < 0 ? step + COLOUR_CYCLE.length : step];
        }
    }

    for (let y = 0; y < DISPLAY_HEIGHT; y++) {
        const source = y + finePixels;
        chip.sourceLine[DISPLAY_TOP + y] = source < DISPLAY_HEIGHT ? source : -1;
    }
}
