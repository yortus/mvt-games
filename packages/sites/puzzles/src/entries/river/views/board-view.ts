import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { GridGesturesViewModel } from '@mvtjs/site-kit/input';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';
import { watch } from '@mvtjs/utils';
import { CLASH_CELL_COLOR, CLASH_COLOR, DIM_TEXT_COLOR, FONT_FAMILY, INK_COLOR, NUMBER_TEXTS } from '../../../shared';
import { type ClueState, findEndSide, GIVEN_DRY, isGivenRiver, RIVER, type RiverPuzzle, traceRiver } from '../models';
import { addCellRiver } from './add-cell-river';
import { createBoardGesturesViewModel } from './board-gestures-view-model';
import { type BoardLayout, layOutBoard } from './board-layout';
import { GlintsView } from './glints-view';
import { makeMeadow } from './make-meadow';
import { makeRiverEnds } from './make-river-ends';
import {
    BUSH_COLOR, FIELD_LINE_COLOR, FLOW_MS, FLOWER_MIDDLE_COLOR, GLINT_COLOR, PETAL_COLOR, PETAL_EDGE_COLOR, RIVER_PASS_ALPHAS, RIVER_PASS_COLORS,
    RIVER_PASS_SHARES, STONE_COLOR,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** A valley being solved, or shown solved. */
export interface BoardViewBindings {
    /** The puzzle. The board is built afresh for each new one, fitted to its size. */
    puzzle: () => RiverPuzzle;
    /** The width of the space that the board centres the valley, its numbers and its two ends in. It's read once. */
    width: number;
    /** The height of the space. It's read once. */
    height: number;
    /** Whether the river is drawn across `edge`, given or the player's. */
    isRiverAt: (edge: number) => boolean;
    /** Whether `cell` is marked as meadow, given or the player's. The board draws a flower on the player's meadow. */
    isMeadowAt: (cell: number) => boolean;
    /** Whether `cell` is a given, printed on the valley. A given piece of river has stone banks, and a given dry cell is a bush. */
    isGivenAt: (cell: number) => boolean;
    /** Whether `cell` breaks a rule, which tints it red. */
    isClashAt: (cell: number) => boolean;
    /** How the number of `line` stands, the rows then the columns. A met number fades, and a broken one shows in red. */
    clueStateAt: (line: number) => ClueState;
    /** Whether the puzzle is solved. As it becomes solved, light runs down the river from the spring to the sea, and the meadow blooms. */
    isSolved: () => boolean;
    /** A count that rises with every change to the marks, so the board is redrawn only as they change. */
    changes: () => number;
    /** A count that rises as each puzzle opens, so a fresh copy of the same puzzle, started again, is redrawn too. */
    puzzlesOpened: () => number;
    /** The player tapped `cell`. Without it, the board ignores the pointer. */
    onCellTapped?: (cell: number) => void;
    /** The player dragged across `edge`, from one cell to the next. */
    onDraggedOver?: (edge: number) => void;
    /** The player let go of a drag. */
    onDragFinished?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The valley, seen from above, centred in a space, with its numbers along
 * the top and down the right. The cells are a meadow, chequered in two
 * greens, with blades of grass. The river runs between sandy banks,
 * straight through a cell or bending round, and glints twinkle on its
 * water. It rises in a pool left of the valley, and runs out to the sea
 * below it. A cell that the player marks as meadow grows a white flower,
 * and a given dry cell is a bush. A given piece of river has banks of grey
 * stone. A cell that breaks a rule is tinted red. As the puzzle is solved,
 * light runs down the river from the spring to the sea, and a flower grows
 * on every dry cell.
 *
 * The board is made of layers. From the bottom, they're the meadow, the red
 * cells, the lines between cells and the river. Over those come the
 * plants, the light on the river, the glints, the spring and the sea, the
 * border, and the numbers.
 * The plants are over the river, so a flower that the river runs through
 * shows why its cell is red. The marks are drawn again only as they change,
 * and the light as it runs.
 *
 * The board turns pointer events into positions in cells, and the gestures
 * view model turns those into taps and steps across edges. The relays that
 * the parent view wires decide what each one does.
 *
 * The light's time is presentation state, which the update step moves on.
 * A puzzle that is solved as it first shows has its light all the way down
 * at once.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const view = new Container();
    view.label = 'board';
    const isInteractive = bindings.onCellTapped !== undefined;
    if (isInteractive) view.cursor = 'pointer';
    const watcher = watch({ changes: bindings.changes, isSolved: bindings.isSolved, opened: bindings.puzzlesOpened });

    // The puzzle shown, and what the board built for it. In order, they're its layout, its layers drawn as the marks
    // change, the sides of each cell that the river runs through, and the river's cells from the spring. Then come how
    // many of those cells the light was drawn through, the numbers, and the gestures
    let puzzle: RiverPuzzle | undefined;
    let layout: BoardLayout = layOutBoard({ size: 1, width: 1, height: 1 });
    let clashLayer = new Graphics();
    let river = new Graphics();
    let plants = new Graphics();
    let shine = new Graphics();
    let riverSides = new Uint8Array(0);
    let flowOrder: number[] = [];
    let drawnFlowCount = -1;
    let clueTexts: Text[] = [];
    let gestures: GridGesturesViewModel | undefined;
    // Which puzzle the light runs down, whether that puzzle is shown solved, and the light's time since it was solved
    let flowPuzzle = bindings.puzzle();
    let isShowingSolved = bindings.isSolved();
    let flowMs = isShowingSolved ? FLOW_MS : 0;
    build(flowPuzzle);

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
        const shown = bindings.puzzle();
        const isSolved = bindings.isSolved();
        if (shown !== flowPuzzle) {
            // A puzzle that is solved already shows its light all the way down at once
            flowPuzzle = shown;
            isShowingSolved = isSolved;
            flowMs = isSolved ? FLOW_MS : 0;
        }
        else if (isSolved !== isShowingSolved) {
            // The light runs from the moment the puzzle is solved
            isShowingSolved = isSolved;
            flowMs = 0;
        }
        if (isShowingSolved) flowMs = Math.min(FLOW_MS, flowMs + deltaMs);
    }

    function refresh(): void {
        const w = watcher.poll();
        const next = bindings.puzzle();
        // Building a new puzzle's board draws its marks too
        if (next !== puzzle) build(next);
        else if (w.changes.changed || w.isSolved.changed || w.opened.changed) drawMarks();
        const flowCount = isShowingSolved ? Math.ceil((flowOrder.length * flowMs) / FLOW_MS) : 0;
        if (flowCount !== drawnFlowCount) drawShine(flowCount);
    }

    /** Builds the board for `next`: its layout, its layers, its numbers and its gestures. Then it draws the marks. */
    function build(next: RiverPuzzle): void {
        puzzle = next;
        const { size, cellCount } = next.grid;
        layout = layOutBoard({ size, width: bindings.width, height: bindings.height });
        const { cellSize, gridX, gridY } = layout;
        const span = size * cellSize;
        riverSides = new Uint8Array(cellCount);
        flowOrder = traceRiver(next);
        drawnFlowCount = -1;

        for (const child of view.removeChildren()) child.destroy({ children: true });
        const meadow = makeMeadow(size, layout);
        clashLayer = new Graphics();
        const lines = new Graphics();
        for (let i = 1; i < size; i++) {
            lines.moveTo(gridX + i * cellSize, gridY).lineTo(gridX + i * cellSize, gridY + span);
            lines.moveTo(gridX, gridY + i * cellSize).lineTo(gridX + span, gridY + i * cellSize);
        }
        lines.stroke({ color: FIELD_LINE_COLOR, width: 1 });
        river = new Graphics();
        plants = new Graphics();
        shine = new Graphics();
        const glints = GlintsView({ size, layout, isRiverCellAt });
        const ends = makeRiverEnds(next, layout);
        const border = new Graphics().roundRect(gridX, gridY, span, span, cellSize * CORNER_SHARE).stroke({ color: INK_COLOR, width: Math.max(2, cellSize * BORDER_SHARE) });
        view.addChild(meadow, clashLayer, lines, river, plants, shine, glints, ends, border);
        makeClues(next);

        if (isInteractive) {
            view.hitArea = new Rectangle(gridX, gridY, span, span);
            // A drag still going on the last puzzle's gestures is cancelled, so its stroke finishes. The cancel waits
            // until the tick is over, since it fires a relay, and a relay never fires during a refresh.
            const previous = gestures;
            if (previous?.isPressed === true) queueMicrotask(() => previous.cancel());
            gestures = createBoardGesturesViewModel({
                grid: next.grid,
                onTapped: (cell) => bindings.onCellTapped?.(cell),
                onDraggedOver: (edge) => bindings.onDraggedOver?.(edge),
                onDragFinished: () => bindings.onDragFinished?.(),
            });
        }
        drawMarks();
    }

    /** Makes the numbers. There's one above each column, and one right of each row. */
    function makeClues(next: RiverPuzzle): void {
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
            else text.position.set(gridX + size * cellSize + room, gridY + (index + 0.5) * cellSize);
            view.addChild(text);
            clueTexts.push(text);
        }
    }

    /** Finds the sides of each cell that the river runs through, then draws the red cells, the plants and the river, and tints the numbers by how they stand. */
    function drawMarks(): void {
        const { size, cellCount } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        const isSolved = bindings.isSolved();
        for (let cell = 0; cell < cellCount; cell++) riverSides[cell] = findRiverSides(cell);
        clashLayer.clear();
        let hasClashes = false;
        for (let cell = 0; cell < cellCount; cell++) {
            if (isSolved || !bindings.isClashAt(cell)) continue;
            clashLayer.rect(gridX + (cell % size) * cellSize, gridY + Math.floor(cell / size) * cellSize, cellSize, cellSize);
            hasClashes = true;
        }
        if (hasClashes) clashLayer.fill(CLASH_CELL_COLOR);
        drawPlants(isSolved);
        drawRiver();
        drawnFlowCount = -1;
        for (let line = 0; line < clueTexts.length; line++) {
            const state = isSolved ? 'met' : bindings.clueStateAt(line);
            clueTexts[line].tint = state === 'broken' ? CLASH_COLOR : state === 'met' ? DIM_TEXT_COLOR : INK_COLOR;
            clueTexts[line].alpha = state === 'met' ? MET_CLUE_ALPHA : 1;
        }
    }

    /** Draws a bush on each given dry cell, and a flower on each cell the player marked as meadow, or on every dry cell once solved. */
    function drawPlants(isSolved: boolean): void {
        const { size, cellCount } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        const givens = puzzle!.givens;
        plants.clear();
        // Each bush is three leafy circles with an ink edge
        let hasBushes = false;
        for (let cell = 0; cell < cellCount; cell++) {
            if (givens[cell] !== GIVEN_DRY || !bindings.isGivenAt(cell)) continue;
            const x = gridX + ((cell % size) + 0.5) * cellSize;
            const y = gridY + (Math.floor(cell / size) + 0.5) * cellSize;
            const r = cellSize * BUSH_SHARE;
            plants.circle(x - r * 0.7, y + r * 0.25, r).circle(x + r * 0.7, y + r * 0.25, r).circle(x, y - r * 0.45, r * 1.1);
            hasBushes = true;
        }
        if (hasBushes) plants.fill(BUSH_COLOR).stroke({ color: INK_COLOR, width: Math.max(1, cellSize * 0.035) });
        // The flowers' petals are drawn first, all together, then their middles
        const petal = cellSize * PETAL_SHARE;
        const reach = cellSize * PETAL_REACH_SHARE;
        let hasFlowers = false;
        for (let pass = 0; pass < 2; pass++) {
            for (let cell = 0; cell < cellCount; cell++) {
                // A flower that the river runs through stays, to show why its cell is red, until the river is solved
                if ((givens[cell] === GIVEN_DRY && bindings.isGivenAt(cell)) || (isSolved && riverSides[cell] !== 0)) continue;
                if (!bindings.isMeadowAt(cell) && !(isSolved && puzzle!.solutionCells[cell] !== RIVER)) continue;
                const x = gridX + ((cell % size) + 0.5) * cellSize;
                const y = gridY + (Math.floor(cell / size) + 0.5) * cellSize;
                if (pass === 0) {
                    for (let k = 0; k < 5; k++) {
                        const angle = (k / 5) * Math.PI * 2 - Math.PI / 2;
                        plants.circle(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach, petal);
                    }
                }
                else plants.circle(x, y, cellSize * MIDDLE_SHARE);
                hasFlowers = true;
            }
            if (!hasFlowers) break;
            if (pass === 0) plants.fill(PETAL_COLOR).stroke({ color: PETAL_EDGE_COLOR, width: 1 });
            else plants.fill(FLOWER_MIDDLE_COLOR);
        }
    }

    /**
     * Draws the river through every cell it runs through. Its banks come
     * first, sand for the player's reaches and stone for given pieces. Then
     * come its water and the light on it.
     */
    function drawRiver(): void {
        const { cellCount } = puzzle!.grid;
        const { cellSize } = layout;
        river.clear();
        for (let pass = 0; pass < 4; pass++) {
            // The first two passes draw the banks, sand where the player drew, then stone round given pieces
            const isBankPass = pass < 2;
            let hasRiver = false;
            for (let cell = 0; cell < cellCount; cell++) {
                if (riverSides[cell] === 0) continue;
                const isGiven = isGivenRiver(puzzle!.givens[cell]) && bindings.isGivenAt(cell);
                if (isBankPass && isGiven !== (pass === 1)) continue;
                addRiverThrough(river, cell);
                hasRiver = true;
            }
            if (!hasRiver) continue;
            const strokeIndex = isBankPass ? 0 : pass - 1;
            const color = pass === 1 ? STONE_COLOR : RIVER_PASS_COLORS[strokeIndex];
            river.stroke({ color, width: cellSize * RIVER_PASS_SHARES[strokeIndex], alpha: RIVER_PASS_ALPHAS[strokeIndex], cap: 'butt', join: 'round' });
        }
    }

    /** Draws the light running down the solved river, through its first `flowCount` cells from the spring. */
    function drawShine(flowCount: number): void {
        drawnFlowCount = flowCount;
        shine.clear();
        if (flowCount === 0) return;
        for (let i = 0; i < flowCount && i < flowOrder.length; i++) addRiverThrough(shine, flowOrder[i]);
        shine.stroke({ color: GLINT_COLOR, width: layout.cellSize * SHINE_SHARE, alpha: SHINE_ALPHA, cap: 'round', join: 'round' });
    }

    /** Adds the line of the river through `cell` to `graphics`, for the caller to stroke, by the sides found as the marks were last drawn. */
    function addRiverThrough(graphics: Graphics, cell: number): void {
        const { size } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        addCellRiver(graphics, gridX + (cell % size) * cellSize, gridY + Math.floor(cell / size) * cellSize, cellSize, riverSides[cell]);
    }

    /**
     * Returns the sides of `cell` that the river runs through, one bit for
     * each. From the lowest bit, they're up, right, down and left. They're
     * the edges drawn, and the side that each end runs off the valley by.
     */
    function findRiverSides(cell: number): number {
        const { spring, sea, grid } = puzzle!;
        const endSide = findEndSide(cell, spring, sea);
        let sides = endSide >= 0 ? 1 << endSide : 0;
        for (let side = 0; side < 4; side++) {
            const edge = grid.cellEdges[cell * 4 + side];
            if (edge >= 0 && bindings.isRiverAt(edge)) sides |= 1 << side;
        }
        return sides;
    }

    /** Returns whether the river runs through `cell`, as the marks were last drawn. */
    function isRiverCellAt(cell: number): boolean {
        return riverSides[cell] !== 0;
    }

    /** Returns where a point on the board is on the valley, in cells across from its left. */
    function toGridX(x: number): number {
        return (x - layout.gridX) / layout.cellSize;
    }

    /** Returns where a point on the board is on the valley, in cells down from its top. */
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

/** How far from the valley the numbers sit, as a share of a cell. */
const CLUE_GAP_SHARE = 0.4;

/** How faint a number is once it's met, from 0 to 1. */
const MET_CLUE_ALPHA = 0.45;

/** The width of the light that runs down the solved river, as a share of a cell. */
const SHINE_SHARE = 0.16;

/** How strong the light on the solved river is, from 0 to 1. */
const SHINE_ALPHA = 0.85;

/** The radius of a flower's petals, as a share of a cell. */
const PETAL_SHARE = 0.085;

/** How far a flower's petals sit from its middle, as a share of a cell. */
const PETAL_REACH_SHARE = 0.11;

/** The radius of a flower's middle, as a share of a cell. */
const MIDDLE_SHARE = 0.065;

/** The radius of a bush's leaves, as a share of a cell. */
const BUSH_SHARE = 0.15;
