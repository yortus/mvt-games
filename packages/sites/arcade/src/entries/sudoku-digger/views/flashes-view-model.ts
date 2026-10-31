import { watch } from '@mvtjs/utils';
import type { CellEvent } from '../models';
import { CELL_COUNT } from '../sudoku-grid';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The grid's flashes, the presentation state of the moments the model
 * counts: each cell's flashes, from 1 as they start down to 0 as they end,
 * the digit fading from a cell just dug, and the grid's shake at a dead end.
 */
export interface FlashesViewModel {
    /** A dead end's red flash in `cell`. */
    deadEndAt: (cell: number) => number;
    /** A dug cell's gold flash. */
    digFlashAt: (cell: number) => number;
    /** The digit fading from a dug cell, while its flash lasts. */
    fadingDigitAt: (cell: number) => number;
    /** A new digit popping in. */
    popAt: (cell: number) => number;
    /** A needed cell's teal pulse. */
    neededPulseAt: (cell: number) => number;
    /** How far the shake has the grid from its place, in pixels. */
    readonly shakeX: number;
    readonly shakeY: number;
    /** Starts a flash for each count that rose, and fades the others, by `deltaMs`. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FlashesViewModelOptions {
    /** Dead ends the search has met. The cell of each flashes red, and the grid shakes. */
    readonly deadEnds: CellEvent;
    /** Cells dug out. Each flashes gold as its digit fades. */
    readonly dug: CellEvent;
    /** Cells found needed. Each pulses teal. */
    readonly needed: CellEvent;
    /** Seeds placed, and digits the grader placed. Each digit pops in. */
    readonly seeds: CellEvent;
    readonly placements: CellEvent;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the flashes, with none showing. */
export function createFlashesViewModel(options: FlashesViewModelOptions): FlashesViewModel {
    const { deadEnds, dug, needed, seeds, placements } = options;
    const deadEndFlashes = new Float32Array(CELL_COUNT);
    const digFlashes = new Float32Array(CELL_COUNT);
    const pops = new Float32Array(CELL_COUNT);
    const neededPulses = new Float32Array(CELL_COUNT);
    const fadingDigits = new Uint8Array(CELL_COUNT);
    // The shake: how long it has left and how long it has run, and the time since one began
    let shakeLeftMs = 0;
    let shakeAgeMs = 0;
    let msSinceShake = SHAKE_GAP_MS;
    const watcher = watch({
        deadEnds: () => deadEnds.count,
        dug: () => dug.count,
        needed: () => needed.count,
        seeds: () => seeds.count,
        placements: () => placements.count,
    });

    return {
        deadEndAt: (cell) => deadEndFlashes[cell],
        digFlashAt: (cell) => digFlashes[cell],
        fadingDigitAt: (cell) => fadingDigits[cell],
        popAt: (cell) => pops[cell],
        neededPulseAt: (cell) => neededPulses[cell],
        // A wobble that dies away, the same each time
        get shakeX() { return SHAKE_PX * shakeLeftMs / SHAKE_MS * Math.sin(shakeAgeMs * 0.11); },
        get shakeY() { return SHAKE_PX * shakeLeftMs / SHAKE_MS * Math.cos(shakeAgeMs * 0.17); },
        update(deltaMs) {
            const fade = deltaMs / FLASH_MS;
            for (let cell = 0; cell < CELL_COUNT; cell++) {
                deadEndFlashes[cell] = Math.max(0, deadEndFlashes[cell] - fade);
                digFlashes[cell] = Math.max(0, digFlashes[cell] - fade);
                pops[cell] = Math.max(0, pops[cell] - fade);
                neededPulses[cell] = Math.max(0, neededPulses[cell] - deltaMs / NEEDED_PULSE_MS);
            }
            shakeLeftMs = Math.max(0, shakeLeftMs - deltaMs);
            shakeAgeMs += deltaMs;
            msSinceShake += deltaMs;
            const w = watcher.poll();
            if (w.deadEnds.increased) {
                deadEndFlashes[deadEnds.cell] = 1;
                // The search can meet many dead ends a second, so a shake starts only once the last has had its time
                if (msSinceShake >= SHAKE_GAP_MS) {
                    shakeLeftMs = SHAKE_MS;
                    shakeAgeMs = 0;
                    msSinceShake = 0;
                }
            }
            if (w.dug.increased) {
                digFlashes[dug.cell] = 1;
                fadingDigits[dug.cell] = dug.digit;
            }
            if (w.needed.increased) neededPulses[needed.cell] = 1;
            if (w.seeds.increased) pops[seeds.cell] = 1;
            if (w.placements.increased && placements.cell >= 0) pops[placements.cell] = 1;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long a flash or a pop lasts, and the pulse of a cell found needed, in ms. */
const FLASH_MS = 450;
const NEEDED_PULSE_MS = 700;
/** A dead end's shake: how far the grid moves at first, in pixels, how long it lasts, and the least time between two, in ms. */
const SHAKE_PX = 3;
const SHAKE_MS = 220;
const SHAKE_GAP_MS = 350;
