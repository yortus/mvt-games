import { COLOUR_CYCLE, DYCP_TEXT, FONT } from '../../data';
import { type PlasmaPartModel, TURN } from '../../models';
import { bitmapIndex, COLUMNS, DISPLAY_TOP, ROWS, type VirtualChip } from '../chip';

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------

/**
 * Part 3. The plasma is a multicolour bitmap at 80 x 50 blocks: each
 * character cell holds four blocks, and has three colours of its own, so a
 * cell can show the three nearest steps of the colour cycle. Where a cell's
 * blocks want a fourth, the nearest of its three stands in.
 *
 * Across the middle, four rows switch to text mode for a DYCP scroller: 160
 * characters, four per column, redrawn every frame with each column's letter
 * at its own height, and coloured by the plasma behind them.
 */
export function paintPlasmaPart(chip: VirtualChip, plasma: PlasmaPartModel): void {
    const a = TURN * plasma.phaseA;
    const b = TURN * plasma.phaseB;
    const c = TURN * plasma.phaseC;
    const cycleOffset = plasma.cycleOffset;

    chip.setMode(DISPLAY_TOP, DISPLAY_TOP + DYCP_TOP_ROW * 8, 'multicolour-bitmap');
    chip.setMode(DISPLAY_TOP + DYCP_BOTTOM_ROW * 8, DISPLAY_TOP + ROWS * 8, 'multicolour-bitmap');

    for (let cy = 0; cy < ROWS; cy++) {
        const isStrip = cy >= DYCP_TOP_ROW && cy < DYCP_BOTTOM_ROW;
        for (let cx = 0; cx < COLUMNS; cx++) {
            if (isStrip) {
                // A strip cell takes the plasma's colour at its place, for its letter's pixels
                chip.colour[cy * COLUMNS + cx] = colourAt(levelAt(cx * 2, cy * 2, a, b, c, cycleOffset));
                continue;
            }
            paintCell(chip, cx, cy, a, b, c, cycleOffset);
        }
    }

    paintDycp(chip, plasma.dycpOffset, plasma.dycpWavePhase);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The DYCP strip: character rows 11-14, 32 lines tall, letters 8 tall. */
const DYCP_TOP_ROW = 11;
const DYCP_BOTTOM_ROW = 15;
const DYCP_LINES = (DYCP_BOTTOM_ROW - DYCP_TOP_ROW) * 8;
/** The strip's characters: four per column, codes 96-255. */
const DYCP_FIRST_CHAR = 96;
/** The text starts a screen's width off to the right. */
const DYCP_LEAD = COLUMNS;

const BLOCKS_ACROSS = COLUMNS * 2;
const BLOCKS_DOWN = ROWS * 2;
/** One trip round the colour cycle from the plasma's lowest value to its highest. */
const LEVELS_PER_RANGE = COLOUR_CYCLE.length;

/** Each block's distance from the screen's centre, for the plasma's circular wave; computed once. */
const DISTANCES = buildDistances();

// Scratch for one cell, preallocated
const blockLevels = new Int32Array(4);
const slotLevels = new Int32Array(3);
const blockValues = new Uint8Array(4);

function buildDistances(): Float32Array {
    const distances = new Float32Array(BLOCKS_ACROSS * BLOCKS_DOWN);
    for (let y = 0; y < BLOCKS_DOWN; y++) {
        for (let x = 0; x < BLOCKS_ACROSS; x++) {
            // A block is two multicolour pixels by four lines: four screen pixels square
            distances[y * BLOCKS_ACROSS + x] = Math.hypot(x - BLOCKS_ACROSS / 2, y - BLOCKS_DOWN / 2);
        }
    }
    return distances;
}

/** The plasma's value at block (x, y) as a whole step of the colour cycle, not yet wrapped. */
function levelAt(x: number, y: number, a: number, b: number, c: number, cycleOffset: number): number {
    const v = Math.sin(x * 0.13 + a)
        + Math.sin(y * 0.21 + b)
        + Math.sin((x + y) * 0.09 + c)
        + Math.sin(DISTANCES[y * BLOCKS_ACROSS + x] * 0.19 - a);
    return Math.floor(((v + 4) / 8) * LEVELS_PER_RANGE + cycleOffset);
}

function colourAt(level: number): number {
    const i = level % COLOUR_CYCLE.length;
    return COLOUR_CYCLE[i < 0 ? i + COLOUR_CYCLE.length : i];
}

/** One cell's four blocks: up to three colours of its own, each block the nearest of them. */
function paintCell(chip: VirtualChip, cx: number, cy: number, a: number, b: number, c: number, cycleOffset: number): void {
    blockLevels[0] = levelAt(cx * 2, cy * 2, a, b, c, cycleOffset);
    blockLevels[1] = levelAt(cx * 2 + 1, cy * 2, a, b, c, cycleOffset);
    blockLevels[2] = levelAt(cx * 2, cy * 2 + 1, a, b, c, cycleOffset);
    blockLevels[3] = levelAt(cx * 2 + 1, cy * 2 + 1, a, b, c, cycleOffset);

    let slots = 0;
    for (let i = 0; i < 4; i++) {
        const level = blockLevels[i];
        let slot = -1;
        for (let s = 0; s < slots; s++) {
            if (slotLevels[s] === level) slot = s;
        }
        if (slot < 0 && slots < 3) {
            slot = slots++;
            slotLevels[slot] = level;
        }
        if (slot < 0) {
            // A fourth colour: the nearest of the three stands in
            slot = 0;
            for (let s = 1; s < 3; s++) {
                if (Math.abs(slotLevels[s] - level) < Math.abs(slotLevels[slot] - level)) slot = s;
            }
        }
        blockValues[i] = slot + 1;
    }

    const cell = cy * COLUMNS + cx;
    // Bit pair 1 is screen memory's high nibble, 2 its low nibble, 3 colour memory
    chip.screen[cell] = (colourAt(slotLevels[0]) << 4) | (slots > 1 ? colourAt(slotLevels[1]) : 0);
    chip.colour[cell] = slots > 2 ? colourAt(slotLevels[2]) : 0;

    const top = (blockValues[0] * 0b0101_0000) | (blockValues[1] * 0b0000_0101);
    const bottom = (blockValues[2] * 0b0101_0000) | (blockValues[3] * 0b0000_0101);
    const index = bitmapIndex(cx, cy * 8);
    chip.bitmap.fill(top, index, index + 4);
    chip.bitmap.fill(bottom, index + 4, index + 8);
}

function paintDycp(chip: VirtualChip, offset: number, wavePhase: number): void {
    const charset = chip.charset;
    // The strip's characters start blank (the font's block, 127, is among them)
    charset.fill(0, DYCP_FIRST_CHAR * 8);
    for (let row = DYCP_TOP_ROW; row < DYCP_BOTTOM_ROW; row++) {
        for (let col = 0; col < COLUMNS; col++) {
            chip.screen[row * COLUMNS + col] = DYCP_FIRST_CHAR + col * 4 + (row - DYCP_TOP_ROW);
        }
    }

    // Letters move a pixel at a time: whole columns through the text, the rest by shifting the strip's lines left
    const scrollPixels = Math.floor(offset * 8);
    const shift = scrollPixels & 7;
    chip.xOffset.fill(-shift, DISPLAY_TOP + DYCP_TOP_ROW * 8, DISPLAY_TOP + DYCP_BOTTOM_ROW * 8);

    const firstChar = (scrollPixels >> 3) - DYCP_LEAD;
    for (let col = 0; col < COLUMNS; col++) {
        const charIndex = firstChar + col;
        if (charIndex < 0) continue;
        const code = DYCP_TEXT.charCodeAt(charIndex % DYCP_TEXT.length);
        const lift = Math.round((DYCP_LINES - 8) / 2 * (1 + Math.sin(TURN * (wavePhase + col / 22))));
        for (let row = 0; row < 8; row++) {
            const line = lift + row;
            charset[(DYCP_FIRST_CHAR + col * 4 + (line >> 3)) * 8 + (line & 7)] = FONT[code * 8 + row];
        }
    }
}
