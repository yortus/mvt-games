import { assignSpriteSlots } from './multiplexer';
import {
    DISPLAY_HEIGHT, DISPLAY_LEFT, DISPLAY_TOP, DISPLAY_WIDTH, FRAME_HEIGHT, FRAME_WIDTH, HARDWARE_SPRITES,
    MODE_CODES, SPRITE_HEIGHT, type VirtualChip,
} from './virtual-chip';

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

/**
 * Turns the chip's memory and registers into a frame: one colour (0-15) per
 * pixel, `FRAME_WIDTH` x `FRAME_HEIGHT`, into `out`.
 *
 * Line by line, as the chip does: the side borders; then the display window
 * in the line's mode, read through its source line and shifted by its
 * offset, or border (background, if opened) above and below the window;
 * then the sprites the multiplexer gave a slot on that line, backmost slot
 * first. A sprite behind the display shows only on its background pixels;
 * the side borders always hide sprites, the top and bottom ones unless
 * opened.
 */
export function composeFrame(chip: VirtualChip, out: Uint8Array): void {
    assignSpriteSlots(chip);

    for (let line = 0; line < FRAME_HEIGHT; line++) {
        const lineStart = line * FRAME_WIDTH;
        const displayStart = lineStart + DISPLAY_LEFT;
        const displayEnd = displayStart + DISPLAY_WIDTH;
        const border = chip.border[line];
        const background = chip.background[line];

        out.fill(border, lineStart, displayStart);
        out.fill(border, displayEnd, lineStart + FRAME_WIDTH);
        foreground.fill(0);

        const isInWindow = line >= DISPLAY_TOP && line < DISPLAY_TOP + DISPLAY_HEIGHT;
        if (!isInWindow) {
            out.fill(chip.hasOpenBorders ? background : border, displayStart, displayEnd);
        }
        else {
            const source = chip.sourceLine[line];
            if (source < 0 || source >= DISPLAY_HEIGHT) out.fill(background, displayStart, displayEnd);
            else composeDisplayLine(chip, line, source, out, displayStart);
        }

        composeSprites(chip, line, out, lineStart, isInWindow || chip.hasOpenBorders);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Scratch space for one line, preallocated so a frame allocates nothing.
/** 1 where the display line shows a foreground pixel, which a sprite behind the display does not cover. */
const foreground = new Uint8Array(DISPLAY_WIDTH);
/** The sprite in each hardware slot on the current line, or -1. */
const lineSprites = new Int8Array(HARDWARE_SPRITES);

const TEXT = MODE_CODES['text'];
const MULTICOLOUR_TEXT = MODE_CODES['multicolour-text'];
const BITMAP = MODE_CODES['bitmap'];

function composeDisplayLine(chip: VirtualChip, line: number, source: number, out: Uint8Array, start: number): void {
    const { screen, colour, charset, bitmap } = chip;
    const mode = chip.mode[line];
    const offset = chip.xOffset[line];
    const background = chip.background[line];
    const cellBase = (source >> 3) * 40;
    const pixelRow = source & 7;
    const bitmapRow = (source >> 3) * 320 + pixelRow;

    if (mode === TEXT) {
        for (let x = 0; x < DISPLAY_WIDTH; x++) {
            const px = x - offset;
            if (px < 0 || px >= DISPLAY_WIDTH) {
                out[start + x] = background;
                continue;
            }
            const cell = cellBase + (px >> 3);
            const bit = (charset[screen[cell] * 8 + pixelRow] >> (7 - (px & 7))) & 1;
            out[start + x] = bit === 1 ? colour[cell] & 15 : background;
            foreground[x] = bit;
        }
    }
    else if (mode === MULTICOLOUR_TEXT) {
        const multicolour1 = chip.multicolour1[line];
        const multicolour2 = chip.multicolour2[line];
        for (let x = 0; x < DISPLAY_WIDTH; x++) {
            const px = x - offset;
            if (px < 0 || px >= DISPLAY_WIDTH) {
                out[start + x] = background;
                continue;
            }
            const cell = cellBase + (px >> 3);
            const bits = charset[screen[cell] * 8 + pixelRow];
            const cellColour = colour[cell];
            if ((cellColour & 8) === 0) {
                // A cell whose colour is below 8 is hires, in that colour
                const bit = (bits >> (7 - (px & 7))) & 1;
                out[start + x] = bit === 1 ? cellColour : background;
                foreground[x] = bit;
                continue;
            }
            const pair = (bits >> (6 - (px & 6))) & 3;
            out[start + x] = pair === 0 ? background : pair === 1 ? multicolour1 : pair === 2 ? multicolour2 : cellColour & 7;
            foreground[x] = pair >> 1;
        }
    }
    else if (mode === BITMAP) {
        for (let x = 0; x < DISPLAY_WIDTH; x++) {
            const px = x - offset;
            if (px < 0 || px >= DISPLAY_WIDTH) {
                out[start + x] = background;
                continue;
            }
            const cell = cellBase + (px >> 3);
            const bit = (bitmap[bitmapRow + (px >> 3) * 8] >> (7 - (px & 7))) & 1;
            out[start + x] = bit === 1 ? screen[cell] >> 4 : screen[cell] & 15;
            foreground[x] = bit;
        }
    }
    else {
        for (let x = 0; x < DISPLAY_WIDTH; x++) {
            const px = x - offset;
            if (px < 0 || px >= DISPLAY_WIDTH) {
                out[start + x] = background;
                continue;
            }
            const cell = cellBase + (px >> 3);
            const pair = (bitmap[bitmapRow + (px >> 3) * 8] >> (6 - (px & 6))) & 3;
            out[start + x] = pair === 0
                ? background
                : pair === 1 ? screen[cell] >> 4 : pair === 2 ? screen[cell] & 15 : colour[cell] & 15;
            foreground[x] = pair >> 1;
        }
    }
}

function composeSprites(chip: VirtualChip, line: number, out: Uint8Array, lineStart: number, isVisible: boolean): void {
    lineSprites.fill(-1);
    let shown = 0;
    const count = chip.spriteCount;
    for (let i = 0; i < count; i++) {
        const slot = chip.spriteSlot[i];
        if (slot < 0) continue;
        const top = chip.spriteY[i];
        const height = chip.spriteIsExpandedY[i] === 1 ? SPRITE_HEIGHT * 2 : SPRITE_HEIGHT;
        if (line < top || line >= top + height) continue;
        lineSprites[slot] = i;
        shown++;
    }
    chip.spritesOnLine[line] = shown;
    if (!isVisible || shown === 0) return;

    for (let slot = HARDWARE_SPRITES - 1; slot >= 0; slot--) {
        const sprite = lineSprites[slot];
        if (sprite < 0) continue;
        const isExpandedY = chip.spriteIsExpandedY[sprite] === 1;
        const row = isExpandedY ? (line - chip.spriteY[sprite]) >> 1 : line - chip.spriteY[sprite];
        const shapeRow = chip.spriteShape[sprite] * 64 + row * 3;
        const pixelWidth = chip.spriteIsExpandedX[sprite] === 1 ? 2 : 1;
        const left = chip.spriteX[sprite];
        const isBehind = chip.spriteIsBehind[sprite] === 1;
        const ownColour = chip.spriteColour[sprite];

        if (chip.spriteIsMulticolour[sprite] === 1) {
            for (let p = 0; p < 12; p++) {
                const byte = chip.spriteShapes[shapeRow + (p >> 2)];
                const pair = (byte >> (6 - (p & 3) * 2)) & 3;
                if (pair === 0) continue;
                const pixelColour = pair === 1 ? chip.spriteMulticolour1 : pair === 2 ? ownColour : chip.spriteMulticolour2;
                plotSpritePixels(out, lineStart, left + p * 2 * pixelWidth, 2 * pixelWidth, pixelColour, isBehind);
            }
        }
        else {
            for (let p = 0; p < 24; p++) {
                const byte = chip.spriteShapes[shapeRow + (p >> 3)];
                if (((byte >> (7 - (p & 7))) & 1) === 0) continue;
                plotSpritePixels(out, lineStart, left + p * pixelWidth, pixelWidth, ownColour, isBehind);
            }
        }
    }
}

/** Plots `width` pixels of a sprite from frame column `x`, except in the side borders and, if behind, on the display's foreground. */
function plotSpritePixels(out: Uint8Array, lineStart: number, x: number, width: number, pixelColour: number, isBehind: boolean): void {
    for (let i = 0; i < width; i++) {
        const fx = x + i;
        if (fx < DISPLAY_LEFT || fx >= DISPLAY_LEFT + DISPLAY_WIDTH) continue;
        if (isBehind && foreground[fx - DISPLAY_LEFT] === 1) continue;
        out[lineStart + fx] = pixelColour;
    }
}
