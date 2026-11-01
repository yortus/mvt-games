import { Container, type FederatedPointerEvent, Graphics, Rectangle, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import {
    ANSWER_COLOR, CARD_COLOR, CLASH_CELL_COLOR, CLASH_COLOR, DIM_TEXT_COLOR, FONT_FAMILY, INK_COLOR, SOLVED_COLOR, SOLVED_GLOW_COLOR,
    THIN_LINE_COLOR,
} from '../../../shared';
import type { ClueState, EdgeMark, MazePuzzle } from '../models';
import { type BoardGesturesViewModel, createBoardGesturesViewModel } from './board-gestures-view-model';
import { type BoardLayout, layOutBoard, measureClueWidth } from './board-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** A maze being solved, or shown solved. */
export interface BoardViewBindings {
    /** The maze. The board is built afresh for each new one, fitted to its size. */
    maze: () => MazePuzzle;
    /** The space the maze and its clues are fitted into, and centred in, from the board's origin, read once. */
    width: number;
    height: number;
    markAt: (edge: number) => EdgeMark;
    /** Whether `cell`'s marks break a rule, which tints it red. */
    isClashAt: (cell: number) => boolean;
    /** How `line`'s clue stands: met clues fade, and broken ones show in red. */
    clueStateAt: (line: number) => ClueState;
    /** Whether the maze is solved. As it becomes solved, every wall is drawn, and it glows. */
    isSolved: () => boolean;
    /** A count that rises with every change to the marks, so the board is redrawn only as they change. */
    changes: () => number;
    /** The player began a stroke, marked an edge in it, and finished it. Without them, the board takes no input. */
    onStrokeStarted?: () => void;
    onEdgeMarked?: (edge: number, mark: EdgeMark) => void;
    onStrokeFinished?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The maze and its clues, fitted into a space and centred in it. The cells
 * sit on a card, with thin lines between them, and the border is a thick
 * wall. The walls marked are drawn in ink along the lines, and the passages
 * as a line in a pen's blue through the cells' middles. S and E are inked
 * in their cells. The clues are stacked above the maze and set out to its
 * left, each at the line it is for, with a tick on the border.
 *
 * It is made of layers: the card, a glow for when it is solved, the grid's
 * lines, the marks, then the border and the ends, and the clues. The marks
 * are drawn again only as they change. What the taps and drags mean is the
 * gestures view model's to say: the board only turns pointer events into
 * positions in cells.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const view = new Container();
    view.label = 'board';
    const isInteractive = bindings.onEdgeMarked !== undefined;
    if (isInteractive) {
        view.eventMode = 'static';
        view.cursor = 'crosshair';
    }
    const watcher = watch({ changes: bindings.changes, isSolved: bindings.isSolved });

    // The maze shown, and what was built for it
    let maze: MazePuzzle | undefined;
    let layout: BoardLayout = layOutBoard({ rows: 1, cols: 1, clues: [], columnLineCount: 0, width: 1, height: 1 });
    let glow = new Graphics();
    let marks = new Graphics();
    let clueTexts: Text[] = [];
    let clueLines: number[] = [];
    let gestures: BoardGesturesViewModel | undefined;
    // The glow's time, from the moment the maze is solved, and whether the maze shown is solved
    let glowMs = 0;
    let isShowingSolved = false;
    build(bindings.maze());

    if (isInteractive) {
        view.on('pointerdown', (e) => gestures?.press(e.pointerId, ...toGrid(e)));
        view.on('globalpointermove', (e) => gestures?.move(e.pointerId, ...toGrid(e)));
        view.on('pointerup', (e) => gestures?.release(e.pointerId));
        view.on('pointerupoutside', (e) => gestures?.release(e.pointerId));
        view.on('pointercancel', (e) => gestures?.release(e.pointerId));
    }
    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        gestures?.update(deltaMs);
        // The glow rises from the moment the maze is solved
        const isSolved = bindings.isSolved();
        if (isSolved !== isShowingSolved) {
            isShowingSolved = isSolved;
            glowMs = 0;
        }
        if (isShowingSolved) glowMs += deltaMs;
    }

    function refresh(): void {
        const next = bindings.maze();
        if (next !== maze) build(next);
        const w = watcher.poll();
        if (w.changes.changed || w.isSolved.changed) drawMarks();
        glow.alpha = isShowingSolved ? GLOW_ALPHA * Math.min(1, glowMs / GLOW_MS) : 0;
    }

    /** Builds the board for `next`: its layout, its unchanging layers, and its clues. */
    function build(next: MazePuzzle): void {
        maze = next;
        const { grid } = next;
        const { rows, cols } = grid;
        layout = layOutBoard({ rows, cols, clues: next.clues, columnLineCount: grid.columnLineCount, width: bindings.width, height: bindings.height });
        const { cellSize, gridX, gridY } = layout;
        const wallWidth = Math.max(2.5, cellSize * WALL_SHARE);

        for (const child of view.removeChildren()) child.destroy({ children: true });
        const card = new Graphics().rect(gridX, gridY, cols * cellSize, rows * cellSize).fill(CARD_COLOR);
        glow = new Graphics().rect(gridX, gridY, cols * cellSize, rows * cellSize).fill(SOLVED_GLOW_COLOR);
        const lines = new Graphics();
        for (let col = 1; col < cols; col++) lines.moveTo(gridX + col * cellSize, gridY).lineTo(gridX + col * cellSize, gridY + rows * cellSize);
        for (let row = 1; row < rows; row++) lines.moveTo(gridX, gridY + row * cellSize).lineTo(gridX + cols * cellSize, gridY + row * cellSize);
        lines.stroke({ color: THIN_LINE_COLOR, width: 1 });
        marks = new Graphics();
        const border = new Graphics().rect(gridX, gridY, cols * cellSize, rows * cellSize).stroke({ color: INK_COLOR, width: wallWidth * 1.3 });
        // A tick on the border at each line with a clue, pointing to it
        const tick = Math.max(4, cellSize * TICK_SHARE);
        const outside = wallWidth * 0.65;
        for (let col = 1; col < cols; col++) border.moveTo(gridX + col * cellSize, gridY - outside).lineTo(gridX + col * cellSize, gridY - outside - tick);
        for (let row = 1; row < rows; row++) border.moveTo(gridX - outside, gridY + row * cellSize).lineTo(gridX - outside - tick, gridY + row * cellSize);
        border.stroke({ color: INK_COLOR, width: 1.5 });
        view.addChild(card, glow, lines, marks, border, makeEnd(next.start, 'S'), makeEnd(next.end, 'E'));
        makeClues(next);
        glow.alpha = 0;

        if (isInteractive) {
            const reach = cellSize * HIT_MARGIN;
            view.hitArea = new Rectangle(gridX - reach, gridY - reach, cols * cellSize + reach * 2, rows * cellSize + reach * 2);
            gestures = createBoardGesturesViewModel({
                grid,
                markAt: bindings.markAt,
                onStrokeStarted: () => bindings.onStrokeStarted?.(),
                onEdgeMarked: (edge, mark) => bindings.onEdgeMarked?.(edge, mark),
                onStrokeFinished: () => bindings.onStrokeFinished?.(),
            });
        }
        // A maze solved already shows solved at once, with no glow rising
        isShowingSolved = bindings.isSolved();
        glowMs = isShowingSolved ? GLOW_MS : 0;
        drawMarks();
    }

    /** An end of the path: an inked disc in its cell, with its letter. */
    function makeEnd(cell: number, letter: string): Container {
        const { cellSize, gridX, gridY } = layout;
        const { cols } = maze!.grid;
        const end = new Container({ x: gridX + ((cell % cols) + 0.5) * cellSize, y: gridY + (Math.floor(cell / cols) + 0.5) * cellSize });
        const text = new Text({ text: letter, style: { fontFamily: FONT_FAMILY, fontSize: cellSize * 0.34, fontWeight: '700', fill: 0xffffff } });
        text.anchor.set(0.5);
        end.addChild(new Graphics().circle(0, 0, cellSize * END_SHARE).fill(INK_COLOR), text);
        return end;
    }

    /** The clues' numbers: stacked above each line between columns, last nearest, and in a row left of each line between rows. */
    function makeClues(next: MazePuzzle): void {
        const { cellSize, gridX, gridY, clueSize, clueStep, clueGap } = layout;
        const style = { fontFamily: FONT_FAMILY, fontSize: clueSize, fontWeight: '600', fill: 0xffffff } as const;
        clueTexts = [];
        clueLines = [];
        for (let line = 0; line < next.clues.length; line++) {
            const clue = next.clues[line].length === 0 ? EMPTY_CLUE : next.clues[line];
            const isAlongTop = line < next.grid.columnLineCount;
            let x = gridX - clueGap;
            for (let i = clue.length - 1; i >= 0; i--) {
                const text = new Text({ text: String(clue[i]), style });
                if (isAlongTop) {
                    text.anchor.set(0.5);
                    text.position.set(gridX + (line + 1) * cellSize, gridY - clueGap - (clue.length - 1 - i) * clueStep - clueSize * 0.5);
                }
                else {
                    text.anchor.set(1, 0.5);
                    text.position.set(x, gridY + (line - next.grid.columnLineCount + 1) * cellSize);
                    // The number's width and a space, as the layout measures them
                    x -= measureClueWidth([clue[i], 0], clueSize) - measureClueWidth([0], clueSize);
                }
                view.addChild(text);
                clueTexts.push(text);
                clueLines.push(line);
            }
        }
    }

    /** Draws the clashes, the walls and the passages as they stand, and tints the clues by how they stand. */
    function drawMarks(): void {
        const { grid } = maze!;
        const { cols, edgeCount, cellCount, edgeCellA, edgeCellB } = grid;
        const { cellSize, gridX, gridY } = layout;
        const isSolved = bindings.isSolved();
        marks.clear();
        for (let cell = 0; cell < cellCount; cell++) {
            if (!isSolved && bindings.isClashAt(cell)) marks.rect(gridX + (cell % cols) * cellSize, gridY + Math.floor(cell / cols) * cellSize, cellSize, cellSize);
        }
        marks.fill(CLASH_CELL_COLOR);
        // Every edge not a passage is a wall once the maze is solved
        let hasWalls = false;
        for (let edge = 0; edge < edgeCount; edge++) {
            const mark = bindings.markAt(edge);
            if (mark !== 'wall' && !(isSolved && mark !== 'passage')) continue;
            const cell = edgeCellA[edge];
            const x = gridX + (cell % cols) * cellSize;
            const y = gridY + Math.floor(cell / cols) * cellSize;
            if (grid.isEdgeBetweenColumns(edge)) marks.moveTo(x + cellSize, y).lineTo(x + cellSize, y + cellSize);
            else marks.moveTo(x, y + cellSize).lineTo(x + cellSize, y + cellSize);
            hasWalls = true;
        }
        if (hasWalls) marks.stroke({ color: INK_COLOR, width: Math.max(2.5, cellSize * WALL_SHARE), cap: 'square' });
        let hasPassages = false;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (bindings.markAt(edge) !== 'passage') continue;
            const a = edgeCellA[edge];
            const b = edgeCellB[edge];
            marks.moveTo(gridX + ((a % cols) + 0.5) * cellSize, gridY + (Math.floor(a / cols) + 0.5) * cellSize);
            marks.lineTo(gridX + ((b % cols) + 0.5) * cellSize, gridY + (Math.floor(b / cols) + 0.5) * cellSize);
            hasPassages = true;
        }
        if (hasPassages) {
            const color = isSolved ? SOLVED_COLOR : ANSWER_COLOR;
            marks.stroke({ color, width: Math.max(3, cellSize * PATH_SHARE), cap: 'round', join: 'round' });
        }
        for (let i = 0; i < clueTexts.length; i++) {
            const state = isSolved ? 'open' : bindings.clueStateAt(clueLines[i]);
            clueTexts[i].tint = state === 'broken' ? CLASH_COLOR : state === 'met' ? DIM_TEXT_COLOR : INK_COLOR;
            clueTexts[i].alpha = state === 'met' ? MET_CLUE_ALPHA : 1;
        }
    }

    /** Where the pointer is on the maze, in cells, across and down from its top left corner. */
    function toGrid(e: FederatedPointerEvent): [x: number, y: number] {
        const { x, y } = e.getLocalPosition(view);
        return [(x - layout.gridX) / layout.cellSize, (y - layout.gridY) / layout.cellSize];
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A wall's width, the path's, the ticks on the border, and the ends' discs' radius, each as a share of a cell. */
const WALL_SHARE = 0.085;
const PATH_SHARE = 0.15;
const TICK_SHARE = 0.14;
const END_SHARE = 0.27;
/** How far past the maze's border a press still counts, as a share of a cell, so a wall can be drawn from a corner of the border. */
const HIT_MARGIN = 0.45;
/** How faint a clue met is. */
const MET_CLUE_ALPHA = 0.55;
/** How strong the glow of a maze solved grows, and how long it takes, in ms. */
const GLOW_ALPHA = 0.85;
const GLOW_MS = 600;
/** What shows for a line with no wall. */
const EMPTY_CLUE: readonly number[] = [0];
