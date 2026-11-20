import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { GridGesturesViewModel } from '@mvtjs/site-kit/input';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';
import { watch } from '@mvtjs/utils';
import { CLASH_CELL_COLOR, CLASH_COLOR, DIM_TEXT_COLOR, FONT_FAMILY, INK_COLOR, NUMBER_TEXTS } from '../../../shared';
import type { BoatPuzzle, CellMark, ClueState } from '../models';
import { createBoardGesturesViewModel } from './board-gestures-view-model';
import { type BoardLayout, layOutBoard } from './board-layout';
import { darken } from './darken';
import { drawBoats, type DrawBoatsOptions } from './draw-boats';
import { drawHull } from './draw-hull';
import { HULL_COLORS, NAVY_COLOR, RIPPLE_LINE_COLOR, SHALLOWS_COLOR, UNFOUND_HULL_COLOR, WATER_COLOR, WAVE_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** A harbour being solved, or shown solved. */
export interface BoardViewBindings {
    /** The puzzle. The board is built afresh for each new one, fitted to its size. */
    puzzle: () => BoatPuzzle;
    /** The width of the space that the harbour, its numbers and its fleet are centred in. The space starts at the board's origin. Read once. */
    width: number;
    /** The height of the space, read once. */
    height: number;
    /** Whether the fleet list shows under the harbour, read once. */
    hasFleet: boolean;
    /** The mark on `cell`, given or the player's. */
    markAt: (cell: number) => CellMark;
    /** Whether `cell` is a given, printed on the harbour. Givens are drawn in navy. */
    isGivenAt: (cell: number) => boolean;
    /** Whether `cell` holds a boat that breaks a rule. It shows in red. */
    isClashAt: (cell: number) => boolean;
    /** How the number of `line` stands, for the rows and then the columns. A met number fades, and a broken one shows in red. */
    clueStateAt: (line: number) => ClueState;
    /** How many finished boats `length` cells long are marked. The fleet list colours in that many boats of the length. */
    finishedBoatCountOf: (length: number) => number;
    /** Whether the puzzle is solved. As it becomes solved, the shallows clear to blue, and the player's waves go. */
    isSolved: () => boolean;
    /** A count that rises with every change to the marks, so the board is redrawn only when they change. */
    changes: () => number;
    /** A count that rises as each puzzle opens, so the board is redrawn when the same puzzle is started again. */
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
 * The harbour, seen from above, fitted into a space and centred in it. Its
 * numbers run along the top and down the left, and its fleet goes under
 * it. Cells not yet known are pale shallows. A cell the player marks as
 * water turns clear blue, with a white wave on it. Glints twinkle on the
 * water.
 *
 * Boats are drawn whole, a hull for each straight run of boat cells, with a
 * soft shadow on the water and a lighter deck. A dinghy is coral, and longer
 * boats are sunflower, mint and lilac. A boat that breaks a rule shows in
 * red, on red cells.
 *
 * The givens are the waves and boat pieces printed on the harbour at the
 * start. They're drawn in navy. A printed piece of a longer boat is cut
 * square where its boat goes on. It stays navy as the player marks the
 * rest of its boat, even in a boat that breaks a rule. So the player can
 * always see which way its boat runs. The fleet list shows every boat to
 * find, pale until a finished boat of its length is marked.
 *
 * The board is made of layers. The shallows are at the bottom, then the
 * water and red cells, and the clear blue that rises as the puzzle is
 * solved. The ripple lines, the glints, the waves and the boats go over
 * them. The border, the numbers and the fleet list go on top. The marks
 * are drawn again only when they change.
 *
 * The board turns pointer events into positions in cells, and the gestures
 * view model turns those into taps and drags. The view that wires its
 * relays decides what they do.
 *
 * The glints twinkle, and the clear blue rises, in the update step. A
 * puzzle that is solved as it first shows is clear at once.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const view = new Container();
    view.label = 'board';
    const isInteractive = bindings.onCellTapped !== undefined;
    if (isInteractive) view.cursor = 'pointer';
    const watcher = watch({ changes: bindings.changes, isSolved: bindings.isSolved, opened: bindings.puzzlesOpened });

    // The puzzle shown, and what was built for it
    let puzzle = bindings.puzzle();
    let layout = layOut(puzzle);
    let boatsOptions = makeBoatsOptions();
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
    // The glints' time
    let glintMs = 0;
    // The puzzle that the clear blue is for, whether it is shown solved, and the clear blue's time since it was solved
    let clearPuzzle = puzzle;
    let isShowingSolved = bindings.isSolved();
    let clearMs = isShowingSolved ? CLEAR_MS : 0;
    build(puzzle);

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

    /** Returns where the board for `next` goes, fitted into the space. */
    function layOut(next: BoatPuzzle): BoardLayout {
        return layOutBoard({ puzzle: next, hasFleet: bindings.hasFleet, width: bindings.width, height: bindings.height });
    }

    /** Returns what the boats are drawn from, for the puzzle shown and its layout. */
    function makeBoatsOptions(): DrawBoatsOptions {
        return { puzzle, layout, markAt: bindings.markAt, isGivenAt: bindings.isGivenAt, isClashAt: bindings.isClashAt };
    }

    /** Builds the board for `next`: its layout, its unchanging layers, its glints and its numbers. */
    function build(next: BoatPuzzle): void {
        puzzle = next;
        const { size } = next.grid;
        layout = layOut(next);
        boatsOptions = makeBoatsOptions();
        const { cellSize, gridX, gridY } = layout;
        const span = size * cellSize;

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
            // A drag still going on the last puzzle is cancelled, so its relays end with onDragFinished. That relay
            // fires after the tick, since a refresh never changes a model, even through a relay
            const last = gestures;
            if (last !== undefined) queueMicrotask(() => last.cancel());
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

    /** Makes the glints. They're small four-pointed sparkles, scattered over the water, each with its own time to flash. */
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

    /** Makes the numbers, one left of each row and one above each column. */
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

    /** Draws the water and the red cells, the waves, the boats and the fleet list as they stand. Then it tints each number by how it stands. */
    function drawMarks(): void {
        const { size, cellCount } = puzzle.grid;
        const { cellSize, gridX, gridY } = layout;
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
            if (!bindings.isClashAt(cell)) continue;
            water.rect(gridX + (cell % size) * cellSize, gridY + Math.floor(cell / size) * cellSize, cellSize, cellSize);
            hasClashes = true;
        }
        if (hasClashes) water.fill(CLASH_CELL_COLOR);
        drawWaves(bindings.isSolved());
        boats.clear();
        drawBoats(boats, boatsOptions);
        drawFleet();
        for (let line = 0; line < clueTexts.length; line++) {
            const state = bindings.clueStateAt(line);
            clueTexts[line].tint = state === 'broken' ? CLASH_COLOR : state === 'met' ? DIM_TEXT_COLOR : INK_COLOR;
            clueTexts[line].alpha = state === 'met' ? MET_CLUE_ALPHA : 1;
        }
    }

    /**
     * Draws a small wave on each cell marked as water, white for the
     * player's and navy for a given. Once the puzzle is solved, the whole
     * harbour is clear water, so the waves go.
     */
    function drawWaves(isSolved: boolean): void {
        const { size, cellCount } = puzzle.grid;
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
     * Draws the fleet list, every boat to find, longest first. A boat shows
     * in its colour once a finished boat of its length is marked. If more
     * finished boats of a length are marked than the fleet has, every boat
     * of that length shows in red.
     */
    function drawFleet(): void {
        fleet.clear();
        if (!bindings.hasFleet) return;
        const lengths = puzzle.fleet;
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
            const found = bindings.finishedBoatCountOf(length);
            const color = found > count ? CLASH_COLOR : rank < found ? HULL_COLORS[Math.min(length, HULL_COLORS.length) - 1] : UNFOUND_HULL_COLOR;
            const to = x + length * fleetUnit;
            drawHull(fleet, { from: x, to, middle: fleetY, beam, isDown: false, hasStern: true, hasBow: true });
            fleet.fill(color).stroke({ color: darken(color), width: 1.5, join: 'round' });
            x = to + gap;
        }
    }

    /** Returns where a point on the board is on the harbour, in cells across from its left. */
    function toGridX(x: number): number {
        return (x - layout.gridX) / layout.cellSize;
    }

    /** Returns where a point on the board is on the harbour, in cells down from its top. */
    function toGridY(y: number): number {
        return (y - layout.gridY) / layout.cellSize;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The border's width, as a share of a cell. */
const BORDER_SHARE = 0.05;

/** How round the border's corners are, as a share of a cell. */
const CORNER_SHARE = 0.12;

/** How far from the harbour the numbers sit, as a share of a cell. */
const CLUE_GAP_SHARE = 0.4;

/** How faint a met number is. */
const MET_CLUE_ALPHA = 0.45;

/** How far a wave reaches either side of its cell's middle, as a share of a cell. */
const WAVE_SHARE = 0.2;

/** How thick the player's waves are, as a share of a cell. */
const WAVE_WIDTH_SHARE = 0.06;

/** How thick a given wave is, as a share of a cell. */
const GIVEN_WAVE_WIDTH_SHARE = 0.08;

/** The gap between two boats in the fleet list, as a share of a boat cell there. */
const FLEET_GAP_SHARE = 0.7;

/** The beam of a boat in the fleet list, as a share of a boat cell there. */
const FLEET_BEAM_SHARE = 0.62;

/** How many glints there are for each cell. */
const GLINTS_PER_CELL = 0.7;

/** How far a glint's arms reach, as a share of a cell. */
const GLINT_SHARE_OF_CELL = 0.15;

/** How small a glint is as it starts and ends its flash, as a share of its full size. */
const GLINT_LEAST_SCALE = 0.3;

/** How much of its period a glint shines for. */
const GLINT_SHARE = 0.3;

/** The shortest period of a glint, in ms. */
const GLINT_LEAST_MS = 1800;

/** How much longer than the shortest a glint's period may be, in ms. */
const GLINT_SPREAD_MS = 2600;

/** How long the clear blue spends rising as the puzzle is solved, in ms. */
const CLEAR_MS = 700;

/**
 * Returns a number from 0 up to 1 that looks random, but is always the same
 * for the same `index` and `salt`. It scatters the glints the same way each
 * time.
 */
function scatter(index: number, salt: number): number {
    const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
}
