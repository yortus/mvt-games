import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { GridGesturesViewModel } from '@mvtjs/site-kit/input';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';
import { watch } from '@mvtjs/utils';
import { CLASH_CELL_COLOR, CLASH_COLOR, DIM_TEXT_COLOR, FONT_FAMILY, INK_COLOR, NUMBER_TEXTS } from '../../../shared';
import { type ClueState, DOWN, GIVEN_DRY, isGivenRiver, LEFT, RIVER, type RiverPuzzle, traceRiver } from '../models';
import { createBoardGesturesViewModel } from './board-gestures-view-model';
import { type BoardLayout, layOutBoard } from './board-layout';
import {
    BANK_COLOR, BUSH_COLOR, FIELD_LINE_COLOR, FLOWER_MIDDLE_COLOR, GLINT_COLOR, GRASS_COLOR, MEADOW_COLOR, MEADOW_SHADE_COLOR, PETAL_COLOR,
    PETAL_EDGE_COLOR, RIVER_COLOR, RIVER_LIGHT_COLOR,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** A valley being solved, or shown solved. */
export interface BoardViewBindings {
    /** The puzzle. The board is built afresh for each new one, fitted to its size. */
    puzzle: () => RiverPuzzle;
    /** The width of the space the valley, its numbers and its ends are fitted into, and centred in, from the board's origin, read once. */
    width: number;
    /** The height of the space, read once. */
    height: number;
    /** Whether the river is drawn across `edge`, given or the player's. */
    isRiverAt: (edge: number) => boolean;
    /** Whether `cell` is marked as meadow, given or the player's, which grows a flower, or a bush for a given. */
    isMeadowAt: (cell: number) => boolean;
    /** Whether `cell` is a given, printed on the valley. A given piece of river has stone banks. */
    isGivenAt: (cell: number) => boolean;
    /** Whether `cell` breaks a rule, which tints it red. */
    isClashAt: (cell: number) => boolean;
    /** How the number of `line` stands, the rows then the columns: met numbers fade, and broken ones show in red. */
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
 * The valley, seen from above, fitted into a space and centred in it, with
 * its numbers along the top and down the right. The cells are a meadow,
 * chequered in two greens, with blades of grass. The river runs between
 * sandy banks, straight through a cell or bending round, and glints twinkle
 * on its water. It rises in a pool left of the valley, and runs out to the
 * sea below it. A cell the player marks as meadow grows a white flower, and
 * a given dry cell is a bush. A given piece of river has banks of grey
 * stone. A cell that breaks a rule is tinted red. As the puzzle is solved,
 * light runs down the river from the spring to the sea, and a flower grows
 * on every dry cell.
 *
 * It is made of layers: the meadow, the red cells, the lines between cells,
 * the flowers, the river and its light, the glints, the spring and the sea,
 * the border, and the numbers. The marks are drawn again only as they
 * change, and the light as it runs. The board only turns pointer events
 * into positions in cells, for the gestures view model to turn into taps
 * and steps across edges. What those do is up to the view that wires its
 * relays.
 *
 * The glints twinkle, and the light runs, in the update step. A puzzle that
 * is solved as it first shows has its light all the way down at once.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const view = new Container();
    view.label = 'board';
    const isInteractive = bindings.onCellTapped !== undefined;
    if (isInteractive) view.cursor = 'pointer';
    const watcher = watch({ changes: bindings.changes, isSolved: bindings.isSolved, opened: bindings.puzzlesOpened });

    // The puzzle shown, and what was built for it
    let puzzle: RiverPuzzle | undefined;
    let layout: BoardLayout = layOutBoard({ size: 1, width: 1, height: 1 });
    let clashLayer = new Graphics();
    let flowers = new Graphics();
    let river = new Graphics();
    let shine = new Graphics();
    let glints: Graphics[] = [];
    let glintCells = new Int32Array(0);
    let glintPhases = new Float32Array(0);
    let glintPeriods = new Float32Array(0);
    let isRiverCell = new Uint8Array(0);
    let flowOrder: number[] = [];
    let drawnFlowCount = -1;
    let clueTexts: Text[] = [];
    let gestures: GridGesturesViewModel | undefined;
    // The glints' time, the light's time from the moment the puzzle is solved, whether the puzzle shown is solved, and which puzzle that is
    let glintMs = 0;
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
        glintMs += deltaMs;
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
        const next = bindings.puzzle();
        if (next !== puzzle) build(next);
        const w = watcher.poll();
        if (w.changes.changed || w.isSolved.changed || w.opened.changed) drawMarks();
        const flowCount = isShowingSolved ? Math.ceil((flowOrder.length * flowMs) / FLOW_MS) : 0;
        if (flowCount !== drawnFlowCount) drawShine(flowCount);
        // Each glint on the river flashes for a moment once in its period, larger as it brightens
        for (let i = 0; i < glints.length; i++) {
            const at = (glintMs / glintPeriods[i] + glintPhases[i]) % 1;
            const shineAmount = isRiverCell[glintCells[i]] === 1 && at < GLINT_SHARE ? Math.sin((at / GLINT_SHARE) * Math.PI) : 0;
            glints[i].alpha = shineAmount;
            glints[i].scale.set(GLINT_LEAST_SCALE + (1 - GLINT_LEAST_SCALE) * shineAmount);
        }
    }

    /** Builds the board for `next`: its layout, its unchanging layers, its glints, its ends and its numbers. */
    function build(next: RiverPuzzle): void {
        puzzle = next;
        const { size, cellCount } = next.grid;
        layout = layOutBoard({ size, width: bindings.width, height: bindings.height });
        const { cellSize, gridX, gridY } = layout;
        const span = size * cellSize;
        isRiverCell = new Uint8Array(cellCount);
        flowOrder = traceRiver(next);
        drawnFlowCount = -1;

        for (const child of view.removeChildren()) child.destroy({ children: true });
        const meadow = makeMeadow(size);
        clashLayer = new Graphics();
        const lines = new Graphics();
        for (let i = 1; i < size; i++) {
            lines.moveTo(gridX + i * cellSize, gridY).lineTo(gridX + i * cellSize, gridY + span);
            lines.moveTo(gridX, gridY + i * cellSize).lineTo(gridX + span, gridY + i * cellSize);
        }
        lines.stroke({ color: FIELD_LINE_COLOR, width: 1 });
        flowers = new Graphics();
        river = new Graphics();
        shine = new Graphics();
        const glintLayer = makeGlints(size);
        const ends = makeEnds(next);
        const border = new Graphics().roundRect(gridX, gridY, span, span, cellSize * CORNER_SHARE).stroke({ color: INK_COLOR, width: Math.max(2, cellSize * BORDER_SHARE) });
        view.addChild(meadow, clashLayer, lines, flowers, river, shine, glintLayer, ends, border);
        makeClues(next);

        if (isInteractive) {
            view.hitArea = new Rectangle(gridX, gridY, span, span);
            gestures = createBoardGesturesViewModel({
                grid: next.grid,
                onTapped: (cell) => bindings.onCellTapped?.(cell),
                onDraggedOver: (edge) => bindings.onDraggedOver?.(edge),
                onDragFinished: () => bindings.onDragFinished?.(),
            });
        }
        drawMarks();
    }

    /** Makes the meadow: its cells chequered in two greens, with a few blades of grass scattered the same way each time. */
    function makeMeadow(size: number): Graphics {
        const { cellSize, gridX, gridY } = layout;
        const meadow = new Graphics().rect(gridX, gridY, size * cellSize, size * cellSize).fill(MEADOW_COLOR);
        for (let cell = 0; cell < size * size; cell++) {
            const row = Math.floor(cell / size);
            const col = cell % size;
            if ((row + col) % 2 === 1) meadow.rect(gridX + col * cellSize, gridY + row * cellSize, cellSize, cellSize);
        }
        meadow.fill(MEADOW_SHADE_COLOR);
        const blade = cellSize * BLADE_SHARE;
        for (let i = 0; i < size * size * BLADES_PER_CELL; i++) {
            const x = gridX + scatter(i, 5) * size * cellSize;
            const y = gridY + scatter(i, 6) * size * cellSize;
            meadow.moveTo(x - blade * 0.5, y - blade).lineTo(x, y).lineTo(x + blade * 0.4, y - blade * 1.1);
        }
        meadow.stroke({ color: GRASS_COLOR, width: Math.max(1, cellSize * 0.03), cap: 'round', join: 'round' });
        return meadow;
    }

    /** Makes the glints: small four-pointed sparkles, scattered over the valley, each with its own time to flash, which show only on the river. */
    function makeGlints(size: number): Container {
        const { cellSize, gridX, gridY } = layout;
        const layer = new Container();
        const count = Math.round(size * size * GLINTS_PER_CELL);
        glints = [];
        glintCells = new Int32Array(count);
        glintPhases = new Float32Array(count);
        glintPeriods = new Float32Array(count);
        const arm = cellSize * GLINT_SHARE_OF_CELL;
        for (let i = 0; i < count; i++) {
            const glint = new Graphics()
                .poly([0, -arm, arm * 0.22, -arm * 0.22, arm, 0, arm * 0.22, arm * 0.22, 0, arm, -arm * 0.22, arm * 0.22, -arm, 0, -arm * 0.22, -arm * 0.22])
                .fill(GLINT_COLOR);
            // Each glint sits near the middle of its cell, where the river runs
            const cell = Math.floor(scatter(i, 1) * size * size);
            glintCells[i] = cell;
            glint.position.set(
                gridX + ((cell % size) + 0.5 + (scatter(i, 2) - 0.5) * GLINT_SPREAD) * cellSize,
                gridY + (Math.floor(cell / size) + 0.5 + (scatter(i, 3) - 0.5) * GLINT_SPREAD) * cellSize,
            );
            glint.alpha = 0;
            layer.addChild(glint);
            glints.push(glint);
            glintPhases[i] = scatter(i, 4);
            glintPeriods[i] = GLINT_LEAST_MS + scatter(i, 7) * GLINT_SPREAD_MS;
        }
        return layer;
    }

    /** Makes the river's two ends: the pool it rises in, left of the valley, and the sea it runs out to, below it, each with its reach of river from the valley's edge. */
    function makeEnds(next: RiverPuzzle): Container {
        const { cellSize, gridX, gridY } = layout;
        const { size } = next.grid;
        const ends = new Container();
        const springY = gridY + (Math.floor(next.spring / size) + 0.5) * cellSize;
        const seaX = gridX + ((next.sea % size) + 0.5) * cellSize;
        const bottom = gridY + size * cellSize;
        const reach = cellSize * END_SHARE;
        const stubs = new Graphics();
        for (let pass = 0; pass < 3; pass++) {
            stubs.moveTo(gridX - reach, springY).lineTo(gridX, springY);
            stubs.moveTo(seaX, bottom).lineTo(seaX, bottom + reach);
            stubs.stroke({ color: RIVER_PASS_COLORS[pass], width: cellSize * RIVER_PASS_SHARES[pass], alpha: RIVER_PASS_ALPHAS[pass], cap: 'butt' });
        }
        // The pool: water in a ring of sand, with a couple of bubbles rising
        const poolX = gridX - reach - cellSize * POOL_SHARE * 0.6;
        const pool = new Graphics()
            .circle(poolX, springY, cellSize * POOL_SHARE).fill(BANK_COLOR)
            .circle(poolX, springY, cellSize * POOL_SHARE * 0.72).fill(RIVER_COLOR)
            .circle(poolX - cellSize * 0.06, springY - cellSize * 0.05, cellSize * 0.045).fill({ color: GLINT_COLOR, alpha: 0.85 })
            .circle(poolX + cellSize * 0.06, springY + cellSize * 0.04, cellSize * 0.03).fill({ color: GLINT_COLOR, alpha: 0.7 });
        // The sea: a bay of blue in a curve of sand, with a white wave
        const seaY = bottom + reach + cellSize * SEA_SHARE * 0.3;
        const width = cellSize * SEA_SHARE;
        const wave = width * 0.3;
        const sea = new Graphics()
            .ellipse(seaX, seaY, width * 0.62, width * 0.36).fill(BANK_COLOR)
            .ellipse(seaX, seaY + width * 0.04, width * 0.52, width * 0.28).fill(SEA_COLOR)
            .moveTo(seaX - wave, seaY + width * 0.06).quadraticCurveTo(seaX - wave / 2, seaY - width * 0.06, seaX, seaY + width * 0.06)
            .quadraticCurveTo(seaX + wave / 2, seaY + width * 0.18, seaX + wave, seaY + width * 0.06)
            .stroke({ color: GLINT_COLOR, width: Math.max(1.5, cellSize * 0.05), cap: 'round' });
        ends.addChild(stubs, pool, sea);
        return ends;
    }

    /** The numbers: one above each column, and one right of each row. */
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

    /** Draws the red cells, the flowers and the river as they stand, and tints the numbers by how they stand. */
    function drawMarks(): void {
        const { size, cellCount } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        const isSolved = bindings.isSolved();
        for (let cell = 0; cell < cellCount; cell++) isRiverCell[cell] = findRiverSides(cell) !== 0 ? 1 : 0;
        clashLayer.clear();
        let hasClashes = false;
        for (let cell = 0; cell < cellCount; cell++) {
            if (isSolved || !bindings.isClashAt(cell)) continue;
            clashLayer.rect(gridX + (cell % size) * cellSize, gridY + Math.floor(cell / size) * cellSize, cellSize, cellSize);
            hasClashes = true;
        }
        if (hasClashes) clashLayer.fill(CLASH_CELL_COLOR);
        drawFlowers(isSolved);
        drawRiver();
        drawnFlowCount = -1;
        for (let line = 0; line < clueTexts.length; line++) {
            const state = isSolved ? 'met' : bindings.clueStateAt(line);
            clueTexts[line].tint = state === 'broken' ? CLASH_COLOR : state === 'met' ? DIM_TEXT_COLOR : INK_COLOR;
            clueTexts[line].alpha = state === 'met' ? MET_CLUE_ALPHA : 1;
        }
    }

    /** Draws a bush on each given dry cell, and a flower on each cell the player marked as meadow, or on every dry cell once solved. */
    function drawFlowers(isSolved: boolean): void {
        const { size, cellCount } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        const givens = puzzle!.givens;
        flowers.clear();
        // The bushes, each three leafy circles with an ink edge
        let hasBushes = false;
        for (let cell = 0; cell < cellCount; cell++) {
            if (givens[cell] !== GIVEN_DRY || !bindings.isGivenAt(cell)) continue;
            const x = gridX + ((cell % size) + 0.5) * cellSize;
            const y = gridY + (Math.floor(cell / size) + 0.5) * cellSize;
            const r = cellSize * BUSH_SHARE;
            flowers.circle(x - r * 0.7, y + r * 0.25, r).circle(x + r * 0.7, y + r * 0.25, r).circle(x, y - r * 0.45, r * 1.1);
            hasBushes = true;
        }
        if (hasBushes) flowers.fill(BUSH_COLOR).stroke({ color: INK_COLOR, width: Math.max(1, cellSize * 0.035) });
        // The flowers: petals first, all together, then their middles
        const petal = cellSize * PETAL_SHARE;
        const reach = cellSize * PETAL_REACH_SHARE;
        let hasFlowers = false;
        for (let pass = 0; pass < 2; pass++) {
            for (let cell = 0; cell < cellCount; cell++) {
                if ((givens[cell] === GIVEN_DRY && bindings.isGivenAt(cell)) || isRiverCell[cell] === 1) continue;
                if (!bindings.isMeadowAt(cell) && !(isSolved && puzzle!.solutionCells[cell] !== RIVER)) continue;
                const x = gridX + ((cell % size) + 0.5) * cellSize;
                const y = gridY + (Math.floor(cell / size) + 0.5) * cellSize;
                if (pass === 0) {
                    for (let k = 0; k < 5; k++) {
                        const angle = (k / 5) * Math.PI * 2 - Math.PI / 2;
                        flowers.circle(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach, petal);
                    }
                }
                else flowers.circle(x, y, cellSize * MIDDLE_SHARE);
                hasFlowers = true;
            }
            if (!hasFlowers) break;
            if (pass === 0) flowers.fill(PETAL_COLOR).stroke({ color: PETAL_EDGE_COLOR, width: 1 });
            else flowers.fill(FLOWER_MIDDLE_COLOR);
        }
    }

    /**
     * Draws the river through every cell it crosses into: its banks, sand
     * for the player's reaches and stone for given pieces, then its water
     * and the light on it.
     */
    function drawRiver(): void {
        const { cellCount } = puzzle!.grid;
        const { cellSize } = layout;
        river.clear();
        for (let pass = 0; pass < 4; pass++) {
            // The first two passes are the banks: sand where the player drew, then stone round given pieces
            const isBankPass = pass < 2;
            let hasRiver = false;
            for (let cell = 0; cell < cellCount; cell++) {
                const sides = findRiverSides(cell);
                if (sides === 0) continue;
                const isGiven = isGivenRiver(puzzle!.givens[cell]) && bindings.isGivenAt(cell);
                if (isBankPass && isGiven !== (pass === 1)) continue;
                addCellRiver(river, cell, sides);
                hasRiver = true;
            }
            if (!hasRiver) continue;
            const look = isBankPass ? 0 : pass - 1;
            const color = pass === 1 ? STONE_COLOR : RIVER_PASS_COLORS[look];
            river.stroke({ color, width: cellSize * RIVER_PASS_SHARES[look], alpha: RIVER_PASS_ALPHAS[look], cap: 'butt', join: 'round' });
        }
    }

    /** Draws the light running down the solved river, through its first `flowCount` cells from the spring. */
    function drawShine(flowCount: number): void {
        drawnFlowCount = flowCount;
        shine.clear();
        if (flowCount === 0) return;
        for (let i = 0; i < flowCount && i < flowOrder.length; i++) addCellRiver(shine, flowOrder[i], findRiverSides(flowOrder[i]));
        shine.stroke({ color: GLINT_COLOR, width: layout.cellSize * SHINE_SHARE, alpha: SHINE_ALPHA, cap: 'round', join: 'round' });
    }

    /**
     * The sides of `cell` the river runs through, one bit for each, up,
     * right, down and left from the lowest bit: the edges drawn, and the
     * side each end runs off the valley by.
     */
    function findRiverSides(cell: number): number {
        const { spring, sea, grid } = puzzle!;
        let sides = cell === spring ? 1 << LEFT : cell === sea ? 1 << DOWN : 0;
        for (let side = 0; side < 4; side++) {
            const edge = grid.cellEdges[cell * 4 + side];
            if (edge >= 0 && bindings.isRiverAt(edge)) sides |= 1 << side;
        }
        return sides;
    }

    /**
     * Adds the line of the river through `cell` to `graphics`, for the caller
     * to stroke, from the middle of each side it runs through: straight
     * across, a curve round between two sides that meet, or in to the middle
     * from one side, or from three or four.
     */
    function addCellRiver(graphics: Graphics, cell: number, sides: number): void {
        const { size } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        const left = gridX + (cell % size) * cellSize;
        const top = gridY + Math.floor(cell / size) * cellSize;
        const middleX = left + cellSize / 2;
        const middleY = top + cellSize / 2;
        let count = 0;
        for (let side = 0; side < 4; side++) count += (sides >> side) & 1;
        const pointX = (side: number): number => (side === 1 ? left + cellSize : side === 3 ? left : middleX);
        const pointY = (side: number): number => (side === 0 ? top : side === 2 ? top + cellSize : middleY);
        if (count === 2) {
            let first = -1;
            let second = -1;
            for (let side = 0; side < 4; side++) {
                if (((sides >> side) & 1) === 0) continue;
                if (first < 0) first = side;
                else second = side;
            }
            graphics.moveTo(pointX(first), pointY(first));
            // Straight across between opposite sides, or a curve round the middle between sides that meet
            if (second - first === 2) graphics.lineTo(pointX(second), pointY(second));
            else graphics.quadraticCurveTo(middleX, middleY, pointX(second), pointY(second));
            return;
        }
        for (let side = 0; side < 4; side++) {
            if (((sides >> side) & 1) === 0) continue;
            graphics.moveTo(pointX(side), pointY(side)).lineTo(middleX, middleY);
        }
    }

    /** Where a point on the board is on the valley, in cells across from its left. */
    function toGridX(x: number): number {
        return (x - layout.gridX) / layout.cellSize;
    }

    /** Where a point on the board is on the valley, in cells down from its top. */
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

/** How far from the valley the numbers sit, as a share of a cell, and how faint a number met is. */
const CLUE_GAP_SHARE = 0.4;
const MET_CLUE_ALPHA = 0.45;

/** The river's three strokes, one on another: its banks, its water and the light on it, each with its width, as a share of a cell, and how strong it is. */
const RIVER_PASS_COLORS: readonly number[] = [BANK_COLOR, RIVER_COLOR, RIVER_LIGHT_COLOR];
const RIVER_PASS_SHARES: readonly number[] = [0.6, 0.4, 0.09];
const RIVER_PASS_ALPHAS: readonly number[] = [1, 1, 0.75];

/** The grey stone of a given piece's banks, so it stands apart from the sand of the reaches the player draws. */
const STONE_COLOR = 0xb8b4a8;

/** The light that runs down the solved river: its width, as a share of a cell, how strong it is, and how long it takes to reach the sea, in ms. */
const SHINE_SHARE = 0.16;
const SHINE_ALPHA = 0.85;
const FLOW_MS = 1400;

/** The deeper blue of the sea. */
const SEA_COLOR = 0x2f8fd4;

/** How far each end's reach of river runs out from the valley, how big the pool is, and how wide the sea is, as shares of a cell. */
const END_SHARE = 0.2;
const POOL_SHARE = 0.3;
const SEA_SHARE = 1.1;

/** A flower's petals' radius, how far they sit from its middle, and its middle's radius, and a bush's leaves' radius, as shares of a cell. */
const PETAL_SHARE = 0.085;
const PETAL_REACH_SHARE = 0.11;
const MIDDLE_SHARE = 0.065;
const BUSH_SHARE = 0.15;

/** How many blades of grass there are for each cell, and how tall each is, as a share of a cell. */
const BLADES_PER_CELL = 1.2;
const BLADE_SHARE = 0.07;

/** How many glints there are for each cell, how far a glint's arms reach, as a share of a cell, how small it is as it starts and ends its flash, and how far from its cell's middle it may sit, as a share of a cell. */
const GLINTS_PER_CELL = 0.8;
const GLINT_SHARE_OF_CELL = 0.12;
const GLINT_LEAST_SCALE = 0.3;
const GLINT_SPREAD = 0.3;

/** How much of its period a glint shines for, and the shortest period and how much longer one may be, in ms. */
const GLINT_SHARE = 0.3;
const GLINT_LEAST_MS = 1600;
const GLINT_SPREAD_MS = 2400;

/** A number from 0 up to 1 that looks random, but is always the same for the same `index` and `salt`, to scatter the grass and the glints the same way each time. */
function scatter(index: number, salt: number): number {
    const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
}
