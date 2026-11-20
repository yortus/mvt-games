import type { Graphics } from 'pixi.js';
import { CLASH_COLOR } from '../../../shared';
import {
    type BoatPuzzle, type CellMark, GIVEN_END_DOWN, GIVEN_END_LEFT, GIVEN_END_RIGHT, GIVEN_END_UP, GIVEN_MIDDLE,
} from '../models';
import type { BoardLayout } from './board-layout';
import { darken } from './darken';
import { drawHull, measureBowLength, measureSternRound } from './draw-hull';
import { CABIN_COLOR, HULL_COLORS, NAVY_COLOR, SHADOW_COLOR, WINDOW_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** The harbour whose boats are drawn, and where it is. */
export interface DrawBoatsOptions {
    /** The puzzle. */
    readonly puzzle: BoatPuzzle;
    /** Where the harbour is, in pixels. */
    readonly layout: BoardLayout;
    /** The mark on `cell`, given or the player's. */
    readonly markAt: (cell: number) => CellMark;
    /** Whether `cell` is a given, printed on the harbour. */
    readonly isGivenAt: (cell: number) => boolean;
    /** Whether `cell` holds a boat that breaks a rule. */
    readonly isClashAt: (cell: number) => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Adds every boat on the harbour to `graphics`, filled and outlined. Each
 * straight run of boat cells joined side to side is one hull, with a soft
 * shadow on the water and a white cabin. A run that bends, or that breaks a
 * rule, is drawn in red, a block for each cell. A run of givens alone is
 * navy, and a printed piece of a longer boat is cut square where its boat
 * goes on. A printed piece in a run the player has marked stays navy, so
 * the player can still see it.
 *
 * It finds the runs afresh on each call, so call it only when the marks
 * change.
 */
export function drawBoats(graphics: Graphics, options: DrawBoatsOptions): void {
    const { puzzle, markAt, isGivenAt, isClashAt } = options;
    const { size, cellCount } = puzzle.grid;
    // Which run each cell is in, and the run being gathered
    const runOf = new Int32Array(cellCount);
    const run: number[] = [];
    // Every shadow is drawn first, so shadows never fall on a boat
    for (let pass = 0; pass < 2; pass++) {
        const isShadowPass = pass === 0;
        runOf.fill(-1);
        for (let cell = 0; cell < cellCount; cell++) {
            if (runOf[cell] >= 0 || markAt(cell) !== 'boat') continue;
            gatherRun(options, cell, run, runOf);
            let low = run[0];
            let high = run[0];
            let hasClash = false;
            let isAllGiven = true;
            for (let i = 0; i < run.length; i++) {
                low = Math.min(low, run[i]);
                high = Math.max(high, run[i]);
                if (isClashAt(run[i])) hasClash = true;
                if (!isGivenAt(run[i])) isAllGiven = false;
            }
            const isAcross = Math.floor(low / size) === Math.floor(high / size);
            const isDownRun = low % size === high % size;
            if (hasClash || (!isAcross && !isDownRun)) {
                if (isShadowPass) continue;
                drawBlocks(graphics, options, run);
                // Each printed piece in the run still shows as printed, so the player can see which way its boat runs
                for (let i = 0; i < run.length; i++) {
                    if (isGivenAt(run[i])) drawRunHull(graphics, options, run[i], run[i], 1, false, NAVY_COLOR);
                }
                continue;
            }
            const color = isAllGiven ? NAVY_COLOR : HULL_COLORS[Math.min(run.length, HULL_COLORS.length) - 1];
            drawRunHull(graphics, options, low, high, run.length, isShadowPass, color);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Draws one straight run of boat cells, `length` cells from `low` to
 * `high`, as a hull. The shadow pass draws its shadow, and the other pass
 * its hull and cabin. Where the player has marked a boat onto a printed
 * piece, that piece's part of the hull stays navy. So the player can still
 * see the piece, and where it shows the boat ends.
 */
function drawRunHull(
    graphics: Graphics, options: DrawBoatsOptions, low: number, high: number, length: number, isShadowPass: boolean, color: number,
): void {
    const { puzzle, layout, isGivenAt } = options;
    const { grid, givens } = puzzle;
    const { size } = grid;
    const { cellSize, gridX, gridY } = layout;
    // A single cell lies the way a printed end on it points, and across otherwise
    const lowGiven = isGivenAt(low) ? givens[low] : 0;
    const highGiven = isGivenAt(high) ? givens[high] : 0;
    const isDown = length > 1 ? high - low >= size : lowGiven === GIVEN_END_UP || lowGiven === GIVEN_END_DOWN;
    const isLoneMiddle = length === 1 && lowGiven === GIVEN_MIDDLE;
    // A printed end or middle at either end of the run shows that the boat goes on past it
    const backward = isDown ? GIVEN_END_UP : GIVEN_END_LEFT;
    const forward = isDown ? GIVEN_END_DOWN : GIVEN_END_RIGHT;
    const hasStern = !isLoneMiddle && lowGiven !== backward && lowGiven !== GIVEN_MIDDLE;
    const hasBow = !isLoneMiddle && highGiven !== forward && highGiven !== GIVEN_MIDDLE;
    const lowRow = Math.floor(low / size);
    const lowCol = low % size;
    const start = isDown ? gridY + lowRow * cellSize : gridX + lowCol * cellSize;
    const end = start + length * cellSize;
    const middle = isDown ? gridX + (lowCol + 0.5) * cellSize : gridY + (lowRow + 0.5) * cellSize;
    const from = start + (hasStern ? cellSize * HULL_INSET_SHARE : 0);
    const to = end - (hasBow ? cellSize * HULL_INSET_SHARE : 0);
    const beam = cellSize * BEAM_SHARE;
    // The whole hull's stern and bow, which its printed pieces share, so each piece's outline matches the hull's
    const sternRound = measureSternRound(beam, to - from);
    const bowLength = measureBowLength(beam, to - from);
    const shadowAlong = isShadowPass ? cellSize * SHADOW_ALONG_SHARE : 0;
    const shadowAcross = isShadowPass ? cellSize * SHADOW_ACROSS_SHARE : 0;
    if (isLoneMiddle) {
        // A printed middle alone could belong to a boat either way, so it is a square piece, cut on every side
        const inset = cellSize * MIDDLE_INSET_SHARE;
        const x = gridX + lowCol * cellSize + inset + (isDown ? shadowAcross : shadowAlong);
        const y = gridY + lowRow * cellSize + inset + (isDown ? shadowAlong : shadowAcross);
        graphics.roundRect(x, y, cellSize - inset * 2, cellSize - inset * 2, cellSize * 0.08);
    }
    else {
        drawHull(graphics, {
            from: from + shadowAlong, to: to + shadowAlong, middle: middle + shadowAcross, beam, isDown, hasStern, hasBow, sternRound, bowLength,
        });
    }
    if (isShadowPass) {
        graphics.fill({ color: SHADOW_COLOR, alpha: SHADOW_ALPHA });
        return;
    }
    graphics.fill(color).stroke({ color: darken(color), width: Math.max(1, cellSize * OUTLINE_SHARE), join: 'round' });
    if (color !== NAVY_COLOR) {
        // Each printed piece's part of the hull, from its cell's edges, or from the stern or to the bow at the hull's ends
        let hasPieces = false;
        for (let i = 0; i < length; i++) {
            const cell = isDown ? low + i * size : low + i;
            if (!isGivenAt(cell)) continue;
            const pieceFrom = i === 0 ? from : start + i * cellSize;
            const pieceTo = i === length - 1 ? to : start + (i + 1) * cellSize;
            drawHull(graphics, {
                from: pieceFrom, to: pieceTo, middle, beam, isDown, hasStern: hasStern && i === 0, hasBow: hasBow && i === length - 1, sternRound, bowLength,
            });
            hasPieces = true;
        }
        if (hasPieces) graphics.fill(NAVY_COLOR).stroke({ color: darken(NAVY_COLOR), width: Math.max(1, cellSize * OUTLINE_SHARE), join: 'round' });
    }
    // A whole boat has a cabin, and a dinghy a seat. A printed piece of a longer boat has neither, since its cabin may be on the cells beyond
    if (!isLoneMiddle && (length > 1 || (hasStern && hasBow))) drawCabin(graphics, cellSize, from, to, middle, beam, isDown, length);
}

/** Draws a white cabin in the middle of a hull, with little windows, or a seat across a dinghy. */
function drawCabin(
    graphics: Graphics, cellSize: number, from: number, to: number, middle: number, beam: number, isDown: boolean, length: number,
): void {
    const centre = (from + to) / 2;
    const rect = (along: number, across: number, alongSize: number, acrossSize: number, radius: number): void => {
        if (isDown) graphics.roundRect(middle + across - acrossSize / 2, along - alongSize / 2, acrossSize, alongSize, radius);
        else graphics.roundRect(along - alongSize / 2, middle + across - acrossSize / 2, alongSize, acrossSize, radius);
    };
    if (length === 1) {
        rect(centre - cellSize * 0.04, 0, cellSize * 0.1, beam * 0.62, cellSize * 0.03);
        graphics.fill(CABIN_COLOR);
        return;
    }
    const cabin = Math.min((to - from) * CABIN_SHARE, cellSize * MOST_CABIN_SHARE * length);
    rect(centre - cellSize * 0.06, 0, cabin, beam * 0.56, beam * 0.14);
    graphics.fill(CABIN_COLOR);
    // The windows, evenly along the cabin
    const windows = Math.min(length, 4);
    const radius = beam * WINDOW_SHARE;
    for (let i = 0; i < windows; i++) {
        const along = centre - cellSize * 0.06 - cabin / 2 + (cabin * (i + 0.5)) / windows;
        if (isDown) graphics.circle(middle, along, radius);
        else graphics.circle(along, middle, radius);
    }
    graphics.fill(WINDOW_COLOR);
}

/** Draws each cell of `run` that the player marked as a red block, for a run that bends or breaks a rule. */
function drawBlocks(graphics: Graphics, options: DrawBoatsOptions, run: readonly number[]): void {
    const { puzzle, layout, isGivenAt } = options;
    const { size } = puzzle.grid;
    const { cellSize, gridX, gridY } = layout;
    const inset = cellSize * MIDDLE_INSET_SHARE;
    for (let i = 0; i < run.length; i++) {
        const cell = run[i];
        if (isGivenAt(cell)) continue;
        graphics.roundRect(
            gridX + (cell % size) * cellSize + inset, gridY + Math.floor(cell / size) * cellSize + inset, cellSize - inset * 2, cellSize - inset * 2, cellSize * 0.12,
        );
    }
    graphics.fill(CLASH_COLOR).stroke({ color: darken(CLASH_COLOR), width: Math.max(1, cellSize * OUTLINE_SHARE) });
}

/**
 * Gathers the boat cells joined to `first`, side to side, into `run`. It
 * notes in `runOf` that each of them is in the run that starts at `first`.
 */
function gatherRun(options: DrawBoatsOptions, first: number, run: number[], runOf: Int32Array): void {
    const { puzzle, markAt } = options;
    const { sides } = puzzle.grid;
    run.length = 0;
    run.push(first);
    runOf[first] = first;
    for (let i = 0; i < run.length; i++) {
        for (let side = 0; side < 4; side++) {
            const next = sides[run[i] * 4 + side];
            if (next < 0 || runOf[next] >= 0 || markAt(next) !== 'boat') continue;
            runOf[next] = first;
            run.push(next);
        }
    }
}

/** A hull's beam, as a share of a cell. */
const BEAM_SHARE = 0.58;

/** How far a stern or a bow sits in from its cell's edge, as a share of a cell. */
const HULL_INSET_SHARE = 0.1;

/** How thick a hull's outline is, as a share of a cell. */
const OUTLINE_SHARE = 0.03;

/** How far a boat's shadow falls along it, as a share of a cell. */
const SHADOW_ALONG_SHARE = 0.03;

/** How far a boat's shadow falls across it, as a share of a cell. */
const SHADOW_ACROSS_SHARE = 0.07;

/** How dark a boat's shadow is. */
const SHADOW_ALPHA = 0.28;

/** How much of a hull's length its cabin covers. */
const CABIN_SHARE = 0.42;

/** The longest a cabin is for each cell of its boat, as a share of a cell. */
const MOST_CABIN_SHARE = 0.32;

/** A window's radius, as a share of the beam. */
const WINDOW_SHARE = 0.08;

/** How far a square piece, or a red block, sits in from its cell's edges, as a share of a cell. */
const MIDDLE_INSET_SHARE = 0.18;
