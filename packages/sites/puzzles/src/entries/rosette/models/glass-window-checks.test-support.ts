import { describe, expect, it } from 'vitest';
import { PUZZLE_LEVELS } from '../../../shared';
import { findDayFrame } from './find-day-frame';
import { findPuzzleSeed } from './find-puzzle-seed';
import { LEVEL_SETTINGS } from './levels';
import { type GlassWindow, createGlassWindow } from './glass-window';
import type { TilePatch } from './tile-patch';
import { FRAME_ASPECT, FRAME_KINDS, type FrameKind, traceFrame } from './trace-frame';

// The checks every window passes, at every level and in every frame, over a
// run of days. glass-window.test.ts checks a couple of days, and
// glass-window.slow.test.ts twelve. Each check lists what it finds
// wrong, naming the day and the piece, and expects the list to be empty, as
// one expect is far quicker than one for each corner.

/** The first day checked. */
export const FIRST_DAY = 20_400;

export interface GlassWindowChecksOptions {
    /** How many days' windows to check, from FIRST_DAY. */
    readonly days: number;
}

/** Declares the checks of every level's windows and every frame's, each over `days` days. */
export function describeGlassWindowChecks({ days }: GlassWindowChecksOptions): void {
    describe(`windows at every level, over ${days} days`, () => {
        for (const level of PUZZLE_LEVELS) {
            const settings = LEVEL_SETTINGS[level];
            const windows = makeLazily(days, (day) => createGlassWindow({ seed: findPuzzleSeed(day, level), settings, frame: findDayFrame(day) }));

            it(`makes ${level} windows with about the level's glass, at its subtlety`, () => {
                const problems: string[] = [];
                for (const [day, puzzle] of windows()) {
                    const { count, symmetry } = puzzle.patch;
                    // The frame's pieces are cut smaller, so there are a few more pieces than whole ones' worth of glass
                    if (count < settings.tiles || count > settings.tiles * MOST_EXTRA_PIECES) problems.push(`day ${day}: ${count} pieces`);
                    if (puzzle.colours.length !== count) problems.push(`day ${day}: ${puzzle.colours.length} colours`);
                    if (puzzle.closestPair < settings.closestPair) problems.push(`day ${day}: closest pair ${puzzle.closestPair}`);
                    if (!settings.symmetries.includes(symmetry)) problems.push(`day ${day}: ${symmetry}-fold`);
                }
                expect(problems).toEqual([]);
            });

            it(`locks the frame's pieces of a ${level} window, and starts every free piece off its own tile, on one of its shape`, () => {
                const problems: string[] = [];
                for (const [day, puzzle] of windows()) {
                    const { count, shapes, cuts } = puzzle.patch;
                    const { locked, jumble } = puzzle;
                    const freeOfShape = new Map<number, number>();
                    let insideLocks = 0;
                    let locks = 0;
                    for (let t = 0; t < count; t++) {
                        locks += locked[t];
                        if (cuts[t] === 1 && locked[t] === 0) problems.push(`day ${day}, piece ${t}: cut by the frame, not locked`);
                        if (cuts[t] === 0) insideLocks += locked[t];
                        if (locked[t] === 1 && jumble[t] !== t) problems.push(`day ${day}, piece ${t}: locked, not on its own tile`);
                        if (locked[t] === 0 && jumble[t] === t) problems.push(`day ${day}, piece ${t}: free, on its own tile`);
                        if (shapes[jumble[t]] !== shapes[t]) problems.push(`day ${day}, piece ${t}: on a tile of another shape`);
                        if (locked[t] === 0) freeOfShape.set(shapes[t], (freeOfShape.get(shapes[t]) ?? 0) + 1);
                    }
                    // A shape left with one free piece has it locked too, which adds a lock or two at most
                    if (insideLocks > MOST_EXTRA_LOCKS) problems.push(`day ${day}: ${insideLocks} locks inside`);
                    // No shape is left with a lone free piece, which could never move
                    for (const [shape, free] of freeOfShape) if (free < 2) problems.push(`day ${day}: shape ${shape} has a lone free piece`);
                    if (puzzle.fewestSwaps <= 0 || puzzle.fewestSwaps >= count - locks) problems.push(`day ${day}: ${puzzle.fewestSwaps} fewest swaps`);
                }
                expect(problems).toEqual([]);
            });
        }
    });

    describe(`a window cut to each frame, over ${days} days`, () => {
        for (const frame of FRAME_KINDS) {
            const windows = makeLazily(days, (day) => createGlassWindow({ seed: findPuzzleSeed(day, 'hard'), settings: LEVEL_SETTINGS.hard, frame }));

            it(`fills a ${frame} frame with glass, every piece going round the same way`, () => {
                expect(checkGlassFillsFrame(frame, windows())).toEqual([]);
            });

            it(`cuts only the pieces a ${frame} frame crosses, and leaves no slivers`, () => {
                expect(checkCutPieces(windows())).toEqual([]);
            });

            it(`trims only a little from the pieces of a ${frame} window that move, leaving their middles well inside`, () => {
                const { problems, trimmed } = checkTrimmedPieces(windows());
                expect(problems).toEqual([]);
                // Some pieces at the frame move, in every frame
                expect(trimmed).toBeGreaterThan(0);
            });

            it(`leaves no piece of a ${frame} window folding back on itself, which would draw lead that meets nothing`, () => {
                expect(checkNoFoldsBack(windows())).toEqual([]);
            });

            it(`gives every tile of a ${frame} window neighbours, each sharing two corners with it`, () => {
                expect(checkNeighbours(windows())).toEqual([]);
            });

            it(`finds each whole tile of a ${frame} window at its own middle, and none outside the frame`, () => {
                expect(checkTilesFound(windows())).toEqual([]);
            });
        }
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type DayWindow = readonly [day: number, window: GlassWindow];

const MOST_EXTRA_LOCKS = 2;
/** How many more pieces a window has than whole ones' worth of glass, at most, as a share. */
const MOST_EXTRA_PIECES = 1.25;
/** How small a cut piece may be, as a share of the average whole one, a little under the share that makes a sliver. */
const LEAST_CUT_SHARE = 0.25;
/**
 * How small a trimmed piece may be, as a share of the average whole one: less
 * than the share of its own rhombus it keeps, as a thin rhombus is smaller
 * than the average. And the room round a trimmed piece's middle that is all
 * inside the window, in tile edges, checked at points round a circle.
 */
const LEAST_TRIM_SHARE = 0.4;
const RING_ROOM = 0.19;
const RING_CHECKS = 16;

/** Makes each day's window the first time they are asked for, so a test left out of a run makes none. */
function makeLazily(days: number, make: (day: number) => GlassWindow): () => readonly DayWindow[] {
    let windows: DayWindow[] | undefined;
    return () => {
        windows ??= Array.from({ length: days }, (_, i) => [FIRST_DAY + i, make(FIRST_DAY + i)] as const);
        return windows;
    };
}

function checkGlassFillsFrame(frame: FrameKind, windows: readonly DayWindow[]): string[] {
    const problems: string[] = [];
    for (const [day, { patch }] of windows) {
        if (patch.frame !== frame) problems.push(`day ${day}: cut to ${patch.frame}`);
        let glass = 0;
        for (let t = 0; t < patch.count; t++) {
            const area = measureTileArea(patch, t);
            if (area <= 0) problems.push(`day ${day}, piece ${t}: area ${area}`);
            glass += area;
        }
        // Every frame is FRAME_ASPECT wide for each 1 high, so its width gives its size
        const size = patch.halfWidth / FRAME_ASPECT;
        const frameArea = measureArea(traceFrame(frame)) * size * size;
        if (Math.abs(glass - frameArea) >= 5e-7) problems.push(`day ${day}: ${glass} of glass in a frame of ${frameArea}`);
    }
    return problems;
}

function checkCutPieces(windows: readonly DayWindow[]): string[] {
    const problems: string[] = [];
    for (const [day, { patch }] of windows) {
        for (let t = 0; t < patch.count; t++) {
            const corners = patch.cornerStarts[t + 1] - patch.cornerStarts[t];
            if (patch.cuts[t] === 0 && patch.trims[t] === 0 && corners !== 4) problems.push(`day ${day}, piece ${t}: whole, with ${corners} corners`);
        }
        const least = measureAverageWholeArea(patch) * LEAST_CUT_SHARE;
        for (let t = 0; t < patch.count; t++) {
            if (patch.cuts[t] === 1 && measureTileArea(patch, t) <= least) problems.push(`day ${day}, piece ${t}: a sliver`);
        }
    }
    return problems;
}

function checkTrimmedPieces(windows: readonly DayWindow[]): { problems: string[]; trimmed: number } {
    const problems: string[] = [];
    let trimmed = 0;
    for (const [day, { patch, locked }] of windows) {
        const least = measureAverageWholeArea(patch) * LEAST_TRIM_SHARE;
        for (let t = 0; t < patch.count; t++) {
            if (patch.trims[t] === 0) continue;
            trimmed++;
            const x = patch.middleXs[t];
            const y = patch.middleYs[t];
            if (patch.cuts[t] === 1) problems.push(`day ${day}, piece ${t}: trimmed and cut`);
            if (locked[t] === 1) problems.push(`day ${day}, piece ${t}: trimmed and locked`);
            // Trims keep most of a whole piece of their shape, so they are near the average whole piece
            if (measureTileArea(patch, t) <= least) problems.push(`day ${day}, piece ${t}: trimmed too far`);
            if (patch.tileAt(x, y) !== t) problems.push(`day ${day}, piece ${t}: not found at its middle`);
            // Its ring has room round its middle, all inside the window
            for (let k = 0; k < RING_CHECKS; k++) {
                const angle = (2 * Math.PI * k) / RING_CHECKS;
                if (patch.tileAt(x + Math.cos(angle) * RING_ROOM, y + Math.sin(angle) * RING_ROOM) < 0) {
                    problems.push(`day ${day}, piece ${t}: no room round its middle`);
                    break;
                }
            }
        }
    }
    return { problems, trimmed };
}

function checkNoFoldsBack(windows: readonly DayWindow[]): string[] {
    const problems: string[] = [];
    for (const [day, { patch }] of windows) {
        const { cornerStarts, cornerXs, cornerYs } = patch;
        for (let t = 0; t < patch.count; t++) {
            const from = cornerStarts[t];
            const n = cornerStarts[t + 1] - from;
            for (let k = 0; k < n; k++) {
                const before = from + ((k + n - 1) % n);
                const at = from + k;
                const after = from + ((k + 1) % n);
                const inX = cornerXs[at] - cornerXs[before];
                const inY = cornerYs[at] - cornerYs[before];
                const outX = cornerXs[after] - cornerXs[at];
                const outY = cornerYs[after] - cornerYs[at];
                // Every side has a length, and no corner turns straight back
                const outLength = Math.hypot(outX, outY);
                const turn = (inX * outX + inY * outY) / (Math.hypot(inX, inY) * outLength);
                if (!(outLength > 1e-6) || !(turn > -0.999)) problems.push(`day ${day}, piece ${t}: folds back at corner ${k}`);
            }
        }
    }
    return problems;
}

function checkNeighbours(windows: readonly DayWindow[]): string[] {
    const problems: string[] = [];
    for (const [day, { patch }] of windows) {
        for (let t = 0; t < patch.count; t++) {
            const near = patch.neighboursOf(t);
            if (near.length === 0) problems.push(`day ${day}, piece ${t}: no neighbours`);
            for (const other of near) {
                if (!patch.neighboursOf(other).includes(t)) problems.push(`day ${day}, piece ${t}: not a neighbour of its neighbour ${other}`);
                if (countSharedCorners(patch, t, other) < 2) problems.push(`day ${day}, piece ${t}: shares under two corners with ${other}`);
            }
        }
    }
    return problems;
}

function checkTilesFound(windows: readonly DayWindow[]): string[] {
    const problems: string[] = [];
    for (const [day, { patch }] of windows) {
        for (let t = 0; t < patch.count; t++) {
            if (patch.cuts[t] === 0 && patch.tileAt(patch.middleXs[t], patch.middleYs[t]) !== t) problems.push(`day ${day}, piece ${t}: not found at its middle`);
        }
        if (patch.tileAt(patch.halfWidth + 1, 0) !== -1) problems.push(`day ${day}: a tile found right of the frame`);
        if (patch.tileAt(0, patch.halfHeight + 1) !== -1) problems.push(`day ${day}: a tile found below the frame`);
    }
    return problems;
}

/** The average area of the pieces neither cut nor trimmed by the frame. */
function measureAverageWholeArea(patch: TilePatch): number {
    let area = 0;
    let wholes = 0;
    for (let t = 0; t < patch.count; t++) {
        if (patch.cuts[t] === 1 || patch.trims[t] === 1) continue;
        area += measureTileArea(patch, t);
        wholes++;
    }
    return area / wholes;
}

function measureTileArea(patch: TilePatch, tile: number): number {
    const points: number[] = [];
    for (let c = patch.cornerStarts[tile]; c < patch.cornerStarts[tile + 1]; c++) points.push(patch.cornerXs[c], patch.cornerYs[c]);
    return measureArea(points);
}

function measureArea(points: readonly number[]): number {
    const n = points.length / 2;
    let area = 0;
    for (let k = 0; k < n; k++) {
        const next = (k + 1) % n;
        area += points[k * 2] * points[next * 2 + 1] - points[next * 2] * points[k * 2 + 1];
    }
    return area / 2;
}

function countSharedCorners(patch: TilePatch, a: number, b: number): number {
    let shared = 0;
    for (let i = patch.cornerStarts[a]; i < patch.cornerStarts[a + 1]; i++) {
        for (let j = patch.cornerStarts[b]; j < patch.cornerStarts[b + 1]; j++) {
            if (Math.hypot(patch.cornerXs[i] - patch.cornerXs[j], patch.cornerYs[i] - patch.cornerYs[j]) < 1e-6) shared++;
        }
    }
    return shared;
}
