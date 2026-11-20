import { Container, Graphics, Rectangle } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';
import { watch } from '@mvtjs/utils';
import { ANSWER_COLOR, CARD_COLOR, CLASH_CELL_COLOR, CLASH_COLOR, INK_COLOR, PENCIL_COLOR, SOLVED_COLOR, SOLVED_GLOW_COLOR, THIN_LINE_COLOR } from '../../../shared';
import type { CellMark, GroupState, StarPuzzle } from '../models';
import { type BoardGesturesViewModel, createBoardGesturesViewModel } from './board-gestures-view-model';
import { type BoardLayout, layOutBoard } from './board-layout';
import { GROUP_COLOR, REGION_TINTS } from './view-constants';

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
    /** Whether `cell` is a given, printed on the grid, which is drawn in ink. */
    isGivenAt: (cell: number) => boolean;
    /** Whether `cell` holds a star that breaks a rule, which shows in red. */
    isClashAt: (cell: number) => boolean;
    /** The groups the player ringed, each its cells. */
    groups: () => readonly (readonly number[])[];
    /** How the group at `index` stands: a met group fades, and a broken one shows in red. */
    groupStateAt: (index: number) => GroupState;
    /** Whether a drag over `cells` would ring them, or take a ring off. A drag that wouldn't is drawn in grey. Without it, every drag is drawn in violet. */
    canRing?: (cells: readonly number[]) => boolean;
    /** Whether the puzzle is solved. As it becomes solved, its stars turn green, and it glows. */
    isSolved: () => boolean;
    /** A count that rises with every change to the marks and groups, so the board is redrawn only as they change. */
    changes: () => number;
    /** A count that rises as each puzzle opens, so a fresh copy of the same puzzle, started again, is redrawn too. */
    puzzlesOpened: () => number;
    /** The player tapped `cell`. Without it, the board takes no input. */
    onCellTapped?: (cell: number) => void;
    /** The player dragged over `cells`, two or more, and let go. */
    onCellsDragged?: (cells: readonly number[]) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The grid, fitted into a space and centred in it. Each region is washed
 * with a soft tint, and drawn round with a thick line in ink, with thin
 * lines between its cells. Dots are small pencil marks, and stars are drawn
 * in a pen's blue, or red where they break a rule, on a red cell. Givens,
 * the stars and dots printed on the grid, are drawn in ink. A group
 * the player ringed is drawn round, just inside its cells, in violet: faint
 * once a star is in it, and red once every cell has a dot. Every ring is
 * drawn the same way in, since groups never overlap. The cells a drag is
 * gathering are washed in violet and drawn round too, or in grey if letting
 * go would do nothing.
 *
 * It is made of layers: the tinted cells, a glow for when it is solved, the
 * thin lines, the marks, the regions' borders, the groups, and the drag.
 * The marks and groups are drawn again only as they change, and the drag
 * as it changes. The board only turns pointer events into positions in
 * cells, for the gestures view model to turn into taps and drags. What
 * those do is up to whoever the board reports to.
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
    let rings = new Graphics();
    let drag = new Graphics();
    let gestures: BoardGesturesViewModel | undefined;
    let drawnDragChanges = -1;
    // Which cells are in the group being drawn round, as it is drawn
    let isInGroup = new Uint8Array(0);
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
        if (w.changes.changed || w.isSolved.changed || w.opened.changed) {
            drawMarks();
            drawRings();
        }
        if (gestures !== undefined && gestures.dragChanges !== drawnDragChanges) drawDrag();
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
        isInGroup = new Uint8Array(cellCount);

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
        rings = new Graphics();
        drag = new Graphics();
        view.addChild(cells, glow, lines, marks, borders, rings, drag);
        glow.alpha = 0;

        if (isInteractive) {
            view.hitArea = new Rectangle(gridX, gridY, span, span);
            gestures = createBoardGesturesViewModel({
                size,
                onTapped: (cell) => bindings.onCellTapped?.(cell),
                onDragged: (dragged) => bindings.onCellsDragged?.(dragged),
            });
            drawnDragChanges = -1;
        }
        // A puzzle solved already shows solved at once, with no glow rising
        isShowingSolved = bindings.isSolved();
        glowMs = isShowingSolved ? GLOW_MS : 0;
        drawMarks();
        drawRings();
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
        // Each kind of mark in one fill: the player's dots, given dots, the player's stars, given stars, then stars that break a rule
        for (let kind = 0; kind < MARK_KINDS; kind++) {
            let hasMarks = false;
            for (let cell = 0; cell < cellCount; cell++) {
                if (findMarkKind(cell, isSolved) !== kind) continue;
                const x = gridX + ((cell % size) + 0.5) * cellSize;
                const y = gridY + (Math.floor(cell / size) + 0.5) * cellSize;
                if (kind === PLAYER_DOT) marks.circle(x, y, Math.max(2, cellSize * DOT_SHARE));
                else if (kind === GIVEN_DOT) marks.circle(x, y, Math.max(2.5, cellSize * GIVEN_DOT_SHARE));
                else marks.star(x, y + cellSize * STAR_DROP, 5, cellSize * STAR_SHARE, cellSize * STAR_SHARE * STAR_INNER);
                hasMarks = true;
            }
            if (hasMarks) marks.fill(MARK_COLORS[kind] ?? (isSolved ? SOLVED_COLOR : ANSWER_COLOR));
        }
    }

    /** Which kind of mark `cell` shows, or -1 for none. */
    function findMarkKind(cell: number, isSolved: boolean): number {
        const mark = bindings.markAt(cell);
        if (mark === 'none') return -1;
        const isGiven = bindings.isGivenAt(cell);
        if (mark === 'dot') return isGiven ? GIVEN_DOT : PLAYER_DOT;
        if (!isSolved && bindings.isClashAt(cell)) return CLASH_STAR;
        return isGiven ? GIVEN_STAR : PLAYER_STAR;
    }

    /** Draws round each group ringed, faint once met and red once broken. */
    function drawRings(): void {
        rings.clear();
        if (bindings.isSolved()) return;
        const groups = bindings.groups();
        const width = Math.max(2, layout.cellSize * RING_SHARE);
        for (let i = 0; i < groups.length; i++) {
            const state = bindings.groupStateAt(i);
            outlineCells(rings, groups[i], layout.cellSize * RING_INSET);
            rings.stroke({ color: state === 'broken' ? CLASH_COLOR : GROUP_COLOR, width, alpha: state === 'met' ? MET_RING_ALPHA : 1, cap: 'round' });
        }
    }

    /** Draws the cells the drag is gathering: washed in violet, and drawn round, or in grey if they can't be ringed. */
    function drawDrag(): void {
        drawnDragChanges = gestures!.dragChanges;
        const cells = gestures!.draggedCells;
        const { size } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        drag.clear();
        if (cells.length === 0) return;
        for (let i = 0; i < cells.length; i++) drag.rect(gridX + (cells[i] % size) * cellSize, gridY + Math.floor(cells[i] / size) * cellSize, cellSize, cellSize);
        const color = cells.length < 2 || (bindings.canRing?.(cells) ?? true) ? GROUP_COLOR : PENCIL_COLOR;
        drag.fill({ color, alpha: DRAG_WASH_ALPHA });
        outlineCells(drag, cells, cellSize * RING_INSET);
        drag.stroke({ color, width: Math.max(2, cellSize * RING_SHARE), cap: 'round' });
    }

    /**
     * Adds the outline of `cells` to `graphics`, `inset` pixels inside them:
     * a line along every side of a cell that no other cell of theirs is
     * across. Where the outline turns a corner, its lines meet, going in at
     * an outer corner and out at an inner one.
     */
    function outlineCells(graphics: Graphics, cells: readonly number[], inset: number): void {
        const { size } = puzzle!.grid;
        const { cellSize, gridX, gridY } = layout;
        for (let i = 0; i < cells.length; i++) isInGroup[cells[i]] = 1;
        const isIn = (row: number, col: number): boolean => row >= 0 && row < size && col >= 0 && col < size && isInGroup[row * size + col] === 1;
        /** Where a side's end goes, along it: in at an outer corner, out at an inner one, and on at a straight run. */
        const findEnd = (edge: number, isOuter: boolean, isInner: boolean, outward: number): number => (isOuter ? edge - outward * inset : isInner ? edge + outward * inset : edge);
        for (let i = 0; i < cells.length; i++) {
            const row = Math.floor(cells[i] / size);
            const col = cells[i] % size;
            const left = gridX + col * cellSize;
            const top = gridY + row * cellSize;
            const right = left + cellSize;
            const bottom = top + cellSize;
            const isLeftIn = isIn(row, col - 1);
            const isRightIn = isIn(row, col + 1);
            const isUpIn = isIn(row - 1, col);
            const isDownIn = isIn(row + 1, col);
            if (!isUpIn) {
                graphics.moveTo(findEnd(left, !isLeftIn, isIn(row - 1, col - 1), -1), top + inset);
                graphics.lineTo(findEnd(right, !isRightIn, isIn(row - 1, col + 1), 1), top + inset);
            }
            if (!isDownIn) {
                graphics.moveTo(findEnd(left, !isLeftIn, isIn(row + 1, col - 1), -1), bottom - inset);
                graphics.lineTo(findEnd(right, !isRightIn, isIn(row + 1, col + 1), 1), bottom - inset);
            }
            if (!isLeftIn) {
                graphics.moveTo(left + inset, findEnd(top, !isUpIn, isIn(row - 1, col - 1), -1));
                graphics.lineTo(left + inset, findEnd(bottom, !isDownIn, isIn(row + 1, col - 1), 1));
            }
            if (!isRightIn) {
                graphics.moveTo(right - inset, findEnd(top, !isUpIn, isIn(row - 1, col + 1), -1));
                graphics.lineTo(right - inset, findEnd(bottom, !isDownIn, isIn(row + 1, col + 1), 1));
            }
        }
        for (let i = 0; i < cells.length; i++) isInGroup[cells[i]] = 0;
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
/** The kinds of mark, in the order they are drawn, and each one's colour. The player's stars are blue, or green once solved. */
const PLAYER_DOT = 0;
const GIVEN_DOT = 1;
const PLAYER_STAR = 2;
const GIVEN_STAR = 3;
const CLASH_STAR = 4;
const MARK_KINDS = 5;
const MARK_COLORS: readonly (number | undefined)[] = [PENCIL_COLOR, INK_COLOR, undefined, INK_COLOR, CLASH_COLOR];
/** A given dot's radius, as a share of a cell: a little bigger than the player's. */
const GIVEN_DOT_SHARE = 0.085;

/** A ring's width, and how far inside its cells it is drawn, each as a share of a cell. */
const RING_SHARE = 0.05;
const RING_INSET = 0.12;
/** How faint a ring with a star in it is, and how strong the wash over a drag's cells. */
const MET_RING_ALPHA = 0.3;
const DRAG_WASH_ALPHA = 0.16;
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
