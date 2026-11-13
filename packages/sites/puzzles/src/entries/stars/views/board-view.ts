import { Container, Graphics, Rectangle } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { GridGesturesViewModel } from '@mvtjs/site-kit/input';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';
import { watch } from '@mvtjs/utils';
import { ANSWER_COLOR, CARD_COLOR, CLASH_CELL_COLOR, CLASH_COLOR, INK_COLOR, PENCIL_COLOR, SOLVED_COLOR, SOLVED_GLOW_COLOR, THIN_LINE_COLOR } from '../../../shared';
import type { CellMark, StarPuzzle } from '../models';
import { createBoardGesturesViewModel } from './board-gestures-view-model';
import { type BoardLayout, layOutBoard } from './board-layout';
import { REGION_TINTS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** A puzzle of stars being solved, or shown solved. */
export interface BoardViewBindings {
    /** The puzzle. The board is built afresh for each new one, fitted to its size. */
    puzzle: () => StarPuzzle;
    /** The space the grid is fitted into, and centred in, from the board's origin, read once. */
    width: number;
    height: number;
    markAt: (cell: number) => CellMark;
    /** Whether `cell` holds a star that breaks a rule, which shows in red. */
    isClashAt: (cell: number) => boolean;
    /** Whether the puzzle is solved. As it becomes solved, its stars turn green, and it glows. */
    isSolved: () => boolean;
    /** A count that rises with every change to the marks, so the board is redrawn only as they change. */
    changes: () => number;
    /** A count that rises as each puzzle opens, so a fresh copy of the same puzzle, started again, is redrawn too. */
    puzzlesOpened: () => number;
    /** The player tapped `cell`. Without it, the board takes no input. */
    onCellTapped?: (cell: number) => void;
    /** The player started a drag at `cell`. Every cell the drag goes over, this one first, is reported next. */
    onDragStarted?: (cell: number) => void;
    onDraggedOver?: (cell: number) => void;
    /** The player let go, after a drag. */
    onDragFinished?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The grid, fitted into a space and centred in it. Each region is washed
 * with a soft tint, and drawn round with a thick line in ink, with thin
 * lines between its cells. Dots are small pencil marks, and stars are drawn
 * in a pen's blue, or red where they break a rule, on a red cell.
 *
 * It is made of layers: the tinted cells, a glow for when it is solved, the
 * thin lines, the marks, and the regions' borders. The marks are drawn
 * again only as they change. The board only turns pointer events into
 * positions in cells, for the gestures view model to turn into taps and
 * drags over cells. What those do is up to whoever the board reports to.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const view = new Container();
    view.label = 'board';
    const isInteractive = bindings.onCellTapped !== undefined;
    if (isInteractive) view.cursor = 'pointer';
    const watcher = watch({ changes: bindings.changes, isSolved: bindings.isSolved, opened: bindings.puzzlesOpened });

    // The puzzle shown, and what was built for it
    let puzzle: StarPuzzle | undefined;
    let layout: BoardLayout = layOutBoard({ size: 1, width: 1, height: 1 });
    let glow = new Graphics();
    let marks = new Graphics();
    let gestures: GridGesturesViewModel | undefined;
    // The glow's time, from the moment the puzzle is solved, and whether the puzzle shown is solved
    let glowMs = 0;
    let isShowingSolved = false;
    build(bindings.puzzle());

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
        // The glow rises from the moment the puzzle is solved
        const isSolved = bindings.isSolved();
        if (isSolved !== isShowingSolved) {
            isShowingSolved = isSolved;
            glowMs = 0;
        }
        if (isShowingSolved) glowMs += deltaMs;
    }

    function refresh(): void {
        const next = bindings.puzzle();
        if (next !== puzzle) build(next);
        const w = watcher.poll();
        if (w.changes.changed || w.isSolved.changed || w.opened.changed) drawMarks();
        glow.alpha = isShowingSolved ? GLOW_ALPHA * Math.min(1, glowMs / GLOW_MS) : 0;
    }

    /** Builds the board for `next`: its layout, and its unchanging layers. */
    function build(next: StarPuzzle): void {
        puzzle = next;
        const { grid, regions } = next;
        const { size, cellCount, sides } = grid;
        layout = layOutBoard({ size, width: bindings.width, height: bindings.height });
        const { cellSize, gridX, gridY } = layout;
        const span = size * cellSize;

        for (const child of view.removeChildren()) child.destroy({ children: true });
        const tints = pickRegionTints(next);
        const cells = new Graphics().rect(gridX, gridY, span, span).fill(CARD_COLOR);
        for (let tint = 0; tint < REGION_TINTS.length; tint++) {
            let hasCells = false;
            for (let cell = 0; cell < cellCount; cell++) {
                if (tints[regions[cell]] !== tint) continue;
                cells.rect(gridX + (cell % size) * cellSize, gridY + Math.floor(cell / size) * cellSize, cellSize, cellSize);
                hasCells = true;
            }
            if (hasCells) cells.fill(REGION_TINTS[tint]);
        }
        glow = new Graphics().rect(gridX, gridY, span, span).fill(SOLVED_GLOW_COLOR);
        const lines = new Graphics();
        for (let i = 1; i < size; i++) {
            lines.moveTo(gridX + i * cellSize, gridY).lineTo(gridX + i * cellSize, gridY + span);
            lines.moveTo(gridX, gridY + i * cellSize).lineTo(gridX + span, gridY + i * cellSize);
        }
        lines.stroke({ color: THIN_LINE_COLOR, width: 1 });
        marks = new Graphics();
        // A thick line wherever two cells side by side are in different regions, then round the edge
        const borders = new Graphics();
        for (let cell = 0; cell < cellCount; cell++) {
            const x = gridX + (cell % size) * cellSize;
            const y = gridY + Math.floor(cell / size) * cellSize;
            const right = sides[cell * 4 + 1];
            const below = sides[cell * 4 + 2];
            if (right >= 0 && regions[right] !== regions[cell]) borders.moveTo(x + cellSize, y).lineTo(x + cellSize, y + cellSize);
            if (below >= 0 && regions[below] !== regions[cell]) borders.moveTo(x, y + cellSize).lineTo(x + cellSize, y + cellSize);
        }
        const borderWidth = Math.max(2, cellSize * BORDER_SHARE);
        borders.stroke({ color: INK_COLOR, width: borderWidth, cap: 'square' });
        borders.rect(gridX, gridY, span, span).stroke({ color: INK_COLOR, width: borderWidth * 1.4 });
        view.addChild(cells, glow, lines, marks, borders);
        glow.alpha = 0;

        if (isInteractive) {
            view.hitArea = new Rectangle(gridX, gridY, span, span);
            gestures = createBoardGesturesViewModel({
                size,
                onTapped: (cell) => bindings.onCellTapped?.(cell),
                onDragStarted: (cell) => bindings.onDragStarted?.(cell),
                onDraggedOver: (cell) => bindings.onDraggedOver?.(cell),
                onDragFinished: () => bindings.onDragFinished?.(),
            });
        }
        // A puzzle solved already shows solved at once, with no glow rising
        isShowingSolved = bindings.isSolved();
        glowMs = isShowingSolved ? GLOW_MS : 0;
        drawMarks();
    }

    /** Draws the clashes, the dots and the stars as they stand. */
    function drawMarks(): void {
        const { size, cellCount } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        const isSolved = bindings.isSolved();
        marks.clear();
        let hasClashes = false;
        for (let cell = 0; cell < cellCount; cell++) {
            if (isSolved || !bindings.isClashAt(cell)) continue;
            marks.rect(gridX + (cell % size) * cellSize, gridY + Math.floor(cell / size) * cellSize, cellSize, cellSize);
            hasClashes = true;
        }
        if (hasClashes) marks.fill(CLASH_CELL_COLOR);
        // Dots, then stars that keep the rules, then stars that break them, each kind in one fill
        for (let kind = 0; kind < 3; kind++) {
            let hasMarks = false;
            for (let cell = 0; cell < cellCount; cell++) {
                const mark = bindings.markAt(cell);
                const isClash = !isSolved && bindings.isClashAt(cell);
                if (kind === 0 ? mark !== 'dot' : mark !== 'star' || isClash !== (kind === 2)) continue;
                const x = gridX + ((cell % size) + 0.5) * cellSize;
                const y = gridY + (Math.floor(cell / size) + 0.5) * cellSize;
                if (kind === 0) marks.circle(x, y, Math.max(2, cellSize * DOT_SHARE));
                else marks.star(x, y + cellSize * STAR_DROP, 5, cellSize * STAR_SHARE, cellSize * STAR_SHARE * STAR_INNER);
                hasMarks = true;
            }
            if (!hasMarks) continue;
            marks.fill(kind === 0 ? PENCIL_COLOR : kind === 2 ? CLASH_COLOR : isSolved ? SOLVED_COLOR : ANSWER_COLOR);
        }
    }

    /** Where a point on the board is on the grid, in cells, across and down from its top left corner. */
    function toGridX(x: number): number {
        return (x - layout.gridX) / layout.cellSize;
    }

    function toGridY(y: number): number {
        return (y - layout.gridY) / layout.cellSize;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A border's width, a dot's radius, a star's radius and how far it sits below the middle, each as a share of a cell, and a star's inner radius, as a share of its outer one. */
const BORDER_SHARE = 0.06;
const DOT_SHARE = 0.07;
const STAR_SHARE = 0.36;
const STAR_DROP = 0.03;
const STAR_INNER = 0.45;
/** How strong the glow of a puzzle solved grows, and how long it takes, in ms. */
const GLOW_ALPHA = 0.85;
const GLOW_MS = 600;

/** Returns a tint for each region, as an index into `REGION_TINTS`, so no two regions that share a side have the same one. */
function pickRegionTints(puzzle: StarPuzzle): number[] {
    const { grid, regions } = puzzle;
    const { size, cellCount, sides } = grid;
    const tints = new Array<number>(size).fill(-1);
    for (let region = 0; region < size; region++) {
        const isTaken = new Array<boolean>(REGION_TINTS.length).fill(false);
        for (let cell = 0; cell < cellCount; cell++) {
            if (regions[cell] !== region) continue;
            for (let side = 0; side < 4; side++) {
                const next = sides[cell * 4 + side];
                if (next >= 0 && regions[next] !== region && tints[regions[next]] >= 0) isTaken[tints[regions[next]]] = true;
            }
        }
        // Start from a different tint for each region, so neighbours far apart vary too
        for (let i = 0; i < REGION_TINTS.length && tints[region] < 0; i++) {
            const tint = (region + i) % REGION_TINTS.length;
            if (!isTaken[tint]) tints[region] = tint;
        }
        if (tints[region] < 0) tints[region] = region % REGION_TINTS.length;
    }
    return tints;
}
