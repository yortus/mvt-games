import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { GridGesturesViewModel } from '@mvtjs/site-kit/input';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';
import { watch } from '@mvtjs/utils';
import { CLASH_CELL_COLOR, CLASH_COLOR, DIM_TEXT_COLOR, FONT_FAMILY, INK_COLOR, NUMBER_TEXTS } from '../../../shared';
import {
    type CellMark, type ClueState, GIVEN_END_DOWN, GIVEN_END_LEFT, GIVEN_END_RIGHT, GIVEN_END_UP, GIVEN_MIDDLE, type BoatPuzzle,
} from '../models';
import { createBoardGesturesViewModel } from './board-gestures-view-model';
import { type BoardLayout, layOutBoard } from './board-layout';
import { drawHull } from './draw-hull';
import {
    CABIN_COLOR, HULL_COLORS, NAVY_COLOR, RIPPLE_LINE_COLOR, SHADOW_COLOR, SHALLOWS_COLOR, UNFOUND_HULL_COLOR, WATER_COLOR, WAVE_COLOR,
    WINDOW_COLOR,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** A harbour being solved, or shown solved. */
export interface BoardViewBindings {
    /** The puzzle. The board is built afresh for each new one, fitted to its size. */
    puzzle: () => BoatPuzzle;
    /** The width of the space the harbour, its numbers and its fleet are fitted into, and centred in, from the board's origin, read once. */
    width: number;
    /** The height of the space, read once. */
    height: number;
    /** Whether the fleet list shows under the harbour, read once. */
    hasFleet: boolean;
    /** The mark on `cell`, given or the player's. */
    markAt: (cell: number) => CellMark;
    /** Whether `cell` is a given, printed on the harbour, which is drawn in navy. */
    isGivenAt: (cell: number) => boolean;
    /** Whether `cell` holds a boat that breaks a rule, which shows in red. */
    isClashAt: (cell: number) => boolean;
    /** How the number of `line` stands, the rows then the columns: met numbers fade, and broken ones show in red. */
    clueStateAt: (line: number) => ClueState;
    /** How many finished boats `length` cells long are marked, which the fleet list ticks off. */
    finishedBoatCountOf: (length: number) => number;
    /** Whether the puzzle is solved. As it becomes solved, the shallows clear to blue, and the player's waves go. */
    isSolved: () => boolean;
    /** A count that rises with every change to the marks, so the board is redrawn only as they change. */
    changes: () => number;
    /** A count that rises as each puzzle opens, so a fresh copy of the same puzzle, started again, is redrawn too. */
    puzzlesOpened: () => number;
    /** The player tapped `cell`. Without it, the board ignores the pointer. */
    onCellTapped?: (cell: number) => void;
    /** The player began a drag at `cell`. */
    onDragStarted?: (cell: number) => void;
    /** The drag went over `cell`. */
    onCellDraggedOver?: (cell: number) => void;
    /** The player let go of a drag. */
    onDragFinished?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The harbour, seen from above, fitted into a space and centred in it, with
 * its numbers along the top and down the left, and its fleet under it. Cells
 * not yet known are pale shallows, and a cell the player marks as water
 * turns clear blue, with a white wave on it. Glints twinkle on the water.
 * Boats are drawn whole, a hull for each straight run of boat cells, with a
 * soft shadow on the water and a white cabin: a dinghy is coral, and longer
 * boats sunflower, mint, lilac and tangerine. Givens, the waves and boat
 * pieces printed on the harbour, are drawn in navy, and a printed piece of a
 * longer boat is cut square where its boat goes on. A printed piece stays
 * navy as the player marks the rest of its boat, so what it says is never
 * hidden. A boat that breaks a rule shows in red, on red cells, with its
 * printed pieces still navy. The fleet list shows every boat to find,
 * pale until a finished boat of its length is marked.
 *
 * It is made of layers: the shallows, the water and red cells, the clear
 * blue that rises as the puzzle is solved, the ripple lines, the glints,
 * the waves, the boats, then the border, the numbers and the fleet list.
 * The marks are drawn again only as they change. The board only turns
 * pointer events into positions in cells, for the gestures view model to
 * turn into taps and drags. What those do is up to the view that wires its
 * relays.
 *
 * The glints twinkle, and the clear blue rises, in the update step. A puzzle
 * that is solved as it first shows is clear at once.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const view = new Container();
    view.label = 'board';
    const isInteractive = bindings.onCellTapped !== undefined;
    if (isInteractive) view.cursor = 'pointer';
    const watcher = watch({ changes: bindings.changes, isSolved: bindings.isSolved, opened: bindings.puzzlesOpened });

    // The puzzle shown, and what was built for it
    let puzzle: BoatPuzzle | undefined;
    let layout: BoardLayout = layOutBoard({ size: 1, fleetCells: 0, fleetBoats: 0, hasFleet: false, width: 1, height: 1 });
    let water = new Graphics();
    let clear = new Graphics();
    let waves = new Graphics();
    let boats = new Graphics();
    let fleet = new Graphics();
    let glints: Graphics[] = [];
    let glintPhases = new Float32Array(0);
    let glintPeriods = new Float32Array(0);
    let clueTexts: Text[] = [];
    let gestures: GridGesturesViewModel | undefined;
    // Scratch space for finding the boats: which run each cell is in, and the run being gathered
    let runOf = new Int32Array(0);
    const run: number[] = [];
    // The glints' time, the clear blue's time from the moment the puzzle is solved, whether the puzzle shown is solved, and which puzzle that is
    let glintMs = 0;
    let clearPuzzle = bindings.puzzle();
    let isShowingSolved = bindings.isSolved();
    let clearMs = isShowingSolved ? CLEAR_MS : 0;
    build(clearPuzzle);

    if (isInteractive) {
        listenToPointer({
            target: view,
            onPressed: (x, y) => gestures?.press(toGridX(x), toGridY(y)),
            onMoved: (x, y) => gestures?.move(toGridX(x), toGridY(y)),
            onReleased: () => gestures?.release(),
            onCancelled: () => gestures?.cancel(),
        });
    }
    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        glintMs += deltaMs;
        const shown = bindings.puzzle();
        const isSolved = bindings.isSolved();
        if (shown !== clearPuzzle) {
            // A puzzle that is solved already shows clear at once
            clearPuzzle = shown;
            isShowingSolved = isSolved;
            clearMs = isSolved ? CLEAR_MS : 0;
        }
        else if (isSolved !== isShowingSolved) {
            // The clear blue rises from the moment the puzzle is solved
            isShowingSolved = isSolved;
            clearMs = 0;
        }
        if (isShowingSolved) clearMs = Math.min(CLEAR_MS, clearMs + deltaMs);
    }

    function refresh(): void {
        const next = bindings.puzzle();
        if (next !== puzzle) build(next);
        const w = watcher.poll();
        if (w.changes.changed || w.isSolved.changed || w.opened.changed) drawMarks();
        clear.alpha = isShowingSolved ? Math.min(1, clearMs / CLEAR_MS) : 0;
        // Each glint flashes for a moment once in its period, larger as it brightens
        for (let i = 0; i < glints.length; i++) {
            const at = (glintMs / glintPeriods[i] + glintPhases[i]) % 1;
            const shine = at < GLINT_SHARE ? Math.sin((at / GLINT_SHARE) * Math.PI) : 0;
            glints[i].alpha = shine;
            glints[i].scale.set(GLINT_LEAST_SCALE + (1 - GLINT_LEAST_SCALE) * shine);
        }
    }

    /** Builds the board for `next`: its layout, its unchanging layers, its glints and its numbers. */
    function build(next: BoatPuzzle): void {
        puzzle = next;
        const { grid, fleet: boatLengths } = next;
        const { size, cellCount } = grid;
        let fleetCells = 0;
        for (let i = 0; i < boatLengths.length; i++) fleetCells += boatLengths[i];
        layout = layOutBoard({ size, fleetCells, fleetBoats: boatLengths.length, hasFleet: bindings.hasFleet, width: bindings.width, height: bindings.height });
        const { cellSize, gridX, gridY } = layout;
        const span = size * cellSize;
        runOf = new Int32Array(cellCount);

        for (const child of view.removeChildren()) child.destroy({ children: true });
        const shallows = new Graphics().rect(gridX, gridY, span, span).fill(SHALLOWS_COLOR);
        water = new Graphics();
        clear = new Graphics().rect(gridX, gridY, span, span).fill(WATER_COLOR);
        clear.alpha = 0;
        const ripples = new Graphics();
        for (let i = 1; i < size; i++) {
            ripples.moveTo(gridX + i * cellSize, gridY).lineTo(gridX + i * cellSize, gridY + span);
            ripples.moveTo(gridX, gridY + i * cellSize).lineTo(gridX + span, gridY + i * cellSize);
        }
        ripples.stroke({ color: RIPPLE_LINE_COLOR, width: 1 });
        const glintLayer = makeGlints(size);
        waves = new Graphics();
        boats = new Graphics();
        const border = new Graphics().roundRect(gridX, gridY, span, span, cellSize * CORNER_SHARE).stroke({ color: INK_COLOR, width: Math.max(2, cellSize * BORDER_SHARE) });
        fleet = new Graphics();
        view.addChild(shallows, water, clear, ripples, glintLayer, waves, boats, border, fleet);
        makeClues(next);

        if (isInteractive) {
            view.hitArea = new Rectangle(gridX, gridY, span, span);
            gestures = createBoardGesturesViewModel({
                size,
                onTapped: (cell) => bindings.onCellTapped?.(cell),
                onDragStarted: (cell) => bindings.onDragStarted?.(cell),
                onDraggedOver: (cell) => bindings.onCellDraggedOver?.(cell),
                onDragFinished: () => bindings.onDragFinished?.(),
            });
        }
        drawMarks();
    }

    /** Makes the glints: small four-pointed sparkles, scattered over the water, each with its own time to flash. */
    function makeGlints(size: number): Container {
        const { cellSize, gridX, gridY } = layout;
        const layer = new Container();
        const count = Math.round(size * size * GLINTS_PER_CELL);
        glints = [];
        glintPhases = new Float32Array(count);
        glintPeriods = new Float32Array(count);
        const arm = cellSize * GLINT_SHARE_OF_CELL;
        for (let i = 0; i < count; i++) {
            const glint = new Graphics()
                .poly([0, -arm, arm * 0.22, -arm * 0.22, arm, 0, arm * 0.22, arm * 0.22, 0, arm, -arm * 0.22, arm * 0.22, -arm, 0, -arm * 0.22, -arm * 0.22])
                .fill(WAVE_COLOR);
            // Scattered the same way for every harbour of a size, so a picture of it is the same each time
            glint.position.set(gridX + scatter(i, 1) * size * cellSize, gridY + scatter(i, 2) * size * cellSize);
            glint.alpha = 0;
            layer.addChild(glint);
            glints.push(glint);
            glintPhases[i] = scatter(i, 3);
            glintPeriods[i] = GLINT_LEAST_MS + scatter(i, 4) * GLINT_SPREAD_MS;
        }
        return layer;
    }

    /** The numbers: one left of each row, and one above each column. */
    function makeClues(next: BoatPuzzle): void {
        const { cellSize, gridX, gridY, clueSize } = layout;
        const { size } = next.grid;
        const style = { fontFamily: FONT_FAMILY, fontSize: clueSize, fontWeight: '700', fill: 0xffffff } as const;
        const room = cellSize * CLUE_GAP_SHARE;
        clueTexts = [];
        for (let line = 0; line < size * 2; line++) {
            const isColumn = line >= size;
            const index = isColumn ? line - size : line;
            const text = new Text({ text: NUMBER_TEXTS[isColumn ? next.colCounts[index] : next.rowCounts[index]], style });
            text.anchor.set(0.5);
            if (isColumn) text.position.set(gridX + (index + 0.5) * cellSize, gridY - room);
            else text.position.set(gridX - room, gridY + (index + 0.5) * cellSize);
            view.addChild(text);
            clueTexts.push(text);
        }
    }

    /** Draws the water and the red cells, the waves, the boats and the fleet list as they stand, and tints the numbers by how they stand. */
    function drawMarks(): void {
        const { size, cellCount } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        const isSolved = bindings.isSolved();
        water.clear();
        let hasWater = false;
        for (let cell = 0; cell < cellCount; cell++) {
            if (bindings.markAt(cell) !== 'water') continue;
            water.rect(gridX + (cell % size) * cellSize, gridY + Math.floor(cell / size) * cellSize, cellSize, cellSize);
            hasWater = true;
        }
        if (hasWater) water.fill(WATER_COLOR);
        let hasClashes = false;
        for (let cell = 0; cell < cellCount; cell++) {
            if (isSolved || !bindings.isClashAt(cell)) continue;
            water.rect(gridX + (cell % size) * cellSize, gridY + Math.floor(cell / size) * cellSize, cellSize, cellSize);
            hasClashes = true;
        }
        if (hasClashes) water.fill(CLASH_CELL_COLOR);
        drawWaves(isSolved);
        drawBoats(isSolved);
        drawFleet();
        for (let line = 0; line < clueTexts.length; line++) {
            const state = isSolved ? 'met' : bindings.clueStateAt(line);
            clueTexts[line].tint = state === 'broken' ? CLASH_COLOR : state === 'met' ? DIM_TEXT_COLOR : INK_COLOR;
            clueTexts[line].alpha = state === 'met' ? MET_CLUE_ALPHA : 1;
        }
    }

    /** Draws a small wave on each cell marked as water: white for the player's, navy for a given. Once solved, the whole harbour is water, so the waves go. */
    function drawWaves(isSolved: boolean): void {
        const { size, cellCount } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        waves.clear();
        if (isSolved) return;
        const reach = cellSize * WAVE_SHARE;
        const rise = reach * 0.55;
        for (let pass = 0; pass < 2; pass++) {
            const isGivenPass = pass === 1;
            let hasWaves = false;
            for (let cell = 0; cell < cellCount; cell++) {
                if (bindings.markAt(cell) !== 'water' || bindings.isGivenAt(cell) !== isGivenPass) continue;
                const x = gridX + ((cell % size) + 0.5) * cellSize;
                const y = gridY + (Math.floor(cell / size) + 0.5) * cellSize;
                waves.moveTo(x - reach, y).quadraticCurveTo(x - reach / 2, y - rise, x, y).quadraticCurveTo(x + reach / 2, y + rise, x + reach, y);
                hasWaves = true;
            }
            if (!hasWaves) continue;
            const width = Math.max(1.5, cellSize * (isGivenPass ? GIVEN_WAVE_WIDTH_SHARE : WAVE_WIDTH_SHARE));
            waves.stroke({ color: isGivenPass ? NAVY_COLOR : WAVE_COLOR, width, cap: 'round', join: 'round' });
        }
    }

    /**
     * Draws every boat: each straight run of boat cells joined side to side,
     * as one hull, its shadow first. A run that bends, or that breaks a rule,
     * is drawn in red, a block for each cell.
     */
    function drawBoats(isSolved: boolean): void {
        const { size, cellCount } = puzzle!.grid;
        boats.clear();
        // Every shadow first, so no shadow falls on a boat
        for (let pass = 0; pass < 2; pass++) {
            const isShadowPass = pass === 0;
            runOf.fill(-1);
            for (let cell = 0; cell < cellCount; cell++) {
                if (runOf[cell] >= 0 || bindings.markAt(cell) !== 'boat') continue;
                gatherRun(cell);
                let low = run[0];
                let high = run[0];
                let hasClash = false;
                let isAllGiven = true;
                for (let i = 0; i < run.length; i++) {
                    low = Math.min(low, run[i]);
                    high = Math.max(high, run[i]);
                    if (!isSolved && bindings.isClashAt(run[i])) hasClash = true;
                    if (!bindings.isGivenAt(run[i])) isAllGiven = false;
                }
                const isAcross = Math.floor(low / size) === Math.floor(high / size);
                const isDownRun = low % size === high % size;
                if (hasClash || (!isAcross && !isDownRun)) {
                    if (isShadowPass) continue;
                    drawBlocks();
                    // Each printed piece in the run still shows as printed, so the player can see what it says
                    for (let i = 0; i < run.length; i++) {
                        if (bindings.isGivenAt(run[i])) drawRunHull(run[i], run[i], 1, false, NAVY_COLOR);
                    }
                    continue;
                }
                const color = isAllGiven ? NAVY_COLOR : HULL_COLORS[Math.min(run.length, HULL_COLORS.length) - 1];
                drawRunHull(low, high, run.length, isShadowPass, color);
            }
        }
    }

    /**
     * Draws one straight run of boat cells, `length` cells from `low` to
     * `high`, as a hull. The shadow pass draws its shadow, and the other pass
     * its hull and cabin. Where the player has marked a boat onto a printed
     * piece, that piece's part of the hull stays navy. So the player can
     * still see the piece, and where it says the boat ends.
     */
    function drawRunHull(low: number, high: number, length: number, isShadowPass: boolean, color: number): void {
        const { grid, givens } = puzzle!;
        const { size } = grid;
        const { cellSize, gridX, gridY } = layout;
        // Which way the hull lies: a single cell lies the way a printed end says, and across otherwise
        const lowGiven = bindings.isGivenAt(low) ? givens[low] : 0;
        const highGiven = bindings.isGivenAt(high) ? givens[high] : 0;
        const isDown = length > 1 ? high - low >= size : lowGiven === GIVEN_END_UP || lowGiven === GIVEN_END_DOWN;
        const isLoneMiddle = length === 1 && lowGiven === GIVEN_MIDDLE;
        // A printed end or middle at either end of the run says the boat goes on past it
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
        const shadowAlong = isShadowPass ? cellSize * SHADOW_ALONG_SHARE : 0;
        const shadowAcross = isShadowPass ? cellSize * SHADOW_ACROSS_SHARE : 0;
        if (isLoneMiddle) {
            // A printed middle alone: which way its boat lies isn't known yet, so it is a square piece, cut on every side
            const inset = cellSize * MIDDLE_INSET_SHARE;
            const x = gridX + lowCol * cellSize + inset + (isDown ? shadowAcross : shadowAlong);
            const y = gridY + lowRow * cellSize + inset + (isDown ? shadowAlong : shadowAcross);
            boats.roundRect(x, y, cellSize - inset * 2, cellSize - inset * 2, cellSize * 0.08);
        }
        else drawHull(boats, { from: from + shadowAlong, to: to + shadowAlong, middle: middle + shadowAcross, beam, isDown, hasStern, hasBow });
        if (isShadowPass) {
            boats.fill({ color: SHADOW_COLOR, alpha: SHADOW_ALPHA });
            return;
        }
        boats.fill(color).stroke({ color: darken(color), width: Math.max(1, cellSize * OUTLINE_SHARE), join: 'round' });
        if (color !== NAVY_COLOR) {
            // Each printed piece's part of the hull, from its cell's edges, or from the stern or to the bow at the hull's ends
            let hasPieces = false;
            for (let i = 0; i < length; i++) {
                const cell = isDown ? low + i * size : low + i;
                if (!bindings.isGivenAt(cell)) continue;
                const pieceFrom = i === 0 ? from : start + i * cellSize;
                const pieceTo = i === length - 1 ? to : start + (i + 1) * cellSize;
                drawHull(boats, { from: pieceFrom, to: pieceTo, middle, beam, isDown, hasStern: hasStern && i === 0, hasBow: hasBow && i === length - 1 });
                hasPieces = true;
            }
            if (hasPieces) boats.fill(NAVY_COLOR).stroke({ color: darken(NAVY_COLOR), width: Math.max(1, cellSize * OUTLINE_SHARE), join: 'round' });
        }
        // A cabin on a whole boat, or a seat across a dinghy. A printed piece of a longer boat has neither, since its cabin may be on the cells beyond
        if (!isLoneMiddle && (length > 1 || (hasStern && hasBow))) drawCabin(from, to, middle, beam, isDown, length);
    }

    /** Draws a white cabin in the middle of a hull, with little windows, or a seat across a dinghy. */
    function drawCabin(from: number, to: number, middle: number, beam: number, isDown: boolean, length: number): void {
        const { cellSize } = layout;
        const centre = (from + to) / 2;
        const rect = (along: number, across: number, alongSize: number, acrossSize: number, radius: number): void => {
            if (isDown) boats.roundRect(middle + across - acrossSize / 2, along - alongSize / 2, acrossSize, alongSize, radius);
            else boats.roundRect(along - alongSize / 2, middle + across - acrossSize / 2, alongSize, acrossSize, radius);
        };
        if (length === 1) {
            rect(centre - cellSize * 0.04, 0, cellSize * 0.1, beam * 0.62, cellSize * 0.03);
            boats.fill(CABIN_COLOR);
            return;
        }
        const cabin = Math.min((to - from) * CABIN_SHARE, cellSize * MOST_CABIN_SHARE * length);
        rect(centre - cellSize * 0.06, 0, cabin, beam * 0.56, beam * 0.14);
        boats.fill(CABIN_COLOR);
        // The windows, evenly along the cabin
        const windows = Math.min(length, 4);
        const radius = beam * WINDOW_SHARE;
        for (let i = 0; i < windows; i++) {
            const along = centre - cellSize * 0.06 - cabin / 2 + (cabin * (i + 0.5)) / windows;
            if (isDown) boats.circle(middle, along, radius);
            else boats.circle(along, middle, radius);
        }
        boats.fill(WINDOW_COLOR);
    }

    /** Draws each cell of `run` the player marked as a red block, for a run that bends or breaks a rule. */
    function drawBlocks(): void {
        const { size } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        const inset = cellSize * MIDDLE_INSET_SHARE;
        for (let i = 0; i < run.length; i++) {
            const cell = run[i];
            if (bindings.isGivenAt(cell)) continue;
            boats.roundRect(gridX + (cell % size) * cellSize + inset, gridY + Math.floor(cell / size) * cellSize + inset, cellSize - inset * 2, cellSize - inset * 2, cellSize * 0.12);
        }
        boats.fill(CLASH_COLOR).stroke({ color: darken(CLASH_COLOR), width: Math.max(1, cellSize * OUTLINE_SHARE) });
    }

    /** Gathers the boat cells joined to `first`, side to side, into `run`, and notes in `runOf` that each is in the run that starts at `first`. */
    function gatherRun(first: number): void {
        const { sides } = puzzle!.grid;
        run.length = 0;
        run.push(first);
        runOf[first] = first;
        for (let i = 0; i < run.length; i++) {
            for (let side = 0; side < 4; side++) {
                const next = sides[run[i] * 4 + side];
                if (next < 0 || runOf[next] >= 0 || bindings.markAt(next) !== 'boat') continue;
                runOf[next] = first;
                run.push(next);
            }
        }
    }

    /** Draws the fleet list: every boat to find, longest first, in its colour once a finished boat of its length is marked, and in red if there are more finished boats of a length than the fleet has. */
    function drawFleet(): void {
        fleet.clear();
        if (!bindings.hasFleet) return;
        const lengths = puzzle!.fleet;
        const { fleetY, fleetUnit } = layout;
        const gap = fleetUnit * FLEET_GAP_SHARE;
        let total = -gap;
        for (let i = 0; i < lengths.length; i++) total += lengths[i] * fleetUnit + gap;
        let x = (bindings.width - total) / 2;
        const beam = fleetUnit * FLEET_BEAM_SHARE;
        for (let i = 0; i < lengths.length; i++) {
            const length = lengths[i];
            // This boat's place among the boats of its length, which are listed together
            let rank = 0;
            let count = 0;
            for (let j = 0; j < lengths.length; j++) {
                if (lengths[j] !== length) continue;
                if (j < i) rank++;
                count++;
            }
            // Once solved, every boat is found, whether or not the water past its ends is marked
            const found = bindings.isSolved() ? count : bindings.finishedBoatCountOf(length);
            const color = found > count ? CLASH_COLOR : rank < found ? HULL_COLORS[Math.min(length, HULL_COLORS.length) - 1] : UNFOUND_HULL_COLOR;
            const to = x + length * fleetUnit;
            drawHull(fleet, { from: x, to, middle: fleetY, beam, isDown: false, hasStern: true, hasBow: true });
            fleet.fill(color).stroke({ color: darken(color), width: 1.5, join: 'round' });
            x = to + gap;
        }
    }

    /** Where a point on the board is on the harbour, in cells across from its left. */
    function toGridX(x: number): number {
        return (x - layout.gridX) / layout.cellSize;
    }

    /** Where a point on the board is on the harbour, in cells down from its top. */
    function toGridY(y: number): number {
        return (y - layout.gridY) / layout.cellSize;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The border's width, and how round its corners are, as shares of a cell. */
const BORDER_SHARE = 0.05;
const CORNER_SHARE = 0.12;

/** How far from the harbour the numbers sit, as a share of a cell, and how faint a number met is. */
const CLUE_GAP_SHARE = 0.4;
const MET_CLUE_ALPHA = 0.45;

/** How far a wave reaches either side of its cell's middle, and how thick the player's waves and a given wave are, as shares of a cell. */
const WAVE_SHARE = 0.2;
const WAVE_WIDTH_SHARE = 0.06;
const GIVEN_WAVE_WIDTH_SHARE = 0.08;

/** A hull's beam, how far a stern or a bow sits in from its cell's edge, and how thick its outline is, as shares of a cell. */
const BEAM_SHARE = 0.58;
const HULL_INSET_SHARE = 0.1;
const OUTLINE_SHARE = 0.03;

/** How far a boat's shadow falls along and across it, as shares of a cell, and how dark it is. */
const SHADOW_ALONG_SHARE = 0.03;
const SHADOW_ACROSS_SHARE = 0.07;
const SHADOW_ALPHA = 0.28;

/** How much of a hull its cabin takes, the longest a cabin is for each cell of the boat, as a share of a cell, and a window's radius, as a share of the beam. */
const CABIN_SHARE = 0.42;
const MOST_CABIN_SHARE = 0.32;
const WINDOW_SHARE = 0.08;

/** How far a square piece, or a red block, sits in from its cell's edges, as a share of a cell. */
const MIDDLE_INSET_SHARE = 0.18;

/** The gap between two boats in the fleet list, and their beam, as shares of a boat cell there. */
const FLEET_GAP_SHARE = 0.7;
const FLEET_BEAM_SHARE = 0.62;

/** How many glints there are for each cell, how far a glint's arms reach, as a share of a cell, and how small it is as it starts and ends its flash. */
const GLINTS_PER_CELL = 0.7;
const GLINT_SHARE_OF_CELL = 0.15;
const GLINT_LEAST_SCALE = 0.3;

/** How much of its period a glint shines for, and the shortest period and how much longer one may be, in ms. */
const GLINT_SHARE = 0.3;
const GLINT_LEAST_MS = 1800;
const GLINT_SPREAD_MS = 2600;

/** How long the clear blue takes to rise as the puzzle is solved, in ms. */
const CLEAR_MS = 700;

/** Returns `color` darker, for an outline round it. */
function darken(color: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * DARKEN);
    const g = Math.floor(((color >> 8) & 0xff) * DARKEN);
    const b = Math.floor((color & 0xff) * DARKEN);
    return (r << 16) | (g << 8) | b;
}

/** How much darker an outline is than what it goes round. */
const DARKEN = 0.68;

/** A number from 0 up to 1 that looks random, but is always the same for the same `index` and `salt`, to scatter the glints the same way each time. */
function scatter(index: number, salt: number): number {
    const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
}
