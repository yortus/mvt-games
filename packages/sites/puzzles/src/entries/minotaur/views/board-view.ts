import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { GridGesturesViewModel } from '@mvtjs/site-kit/input';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';
import { watch } from '@mvtjs/utils';
import { CLASH_CELL_COLOR, CLASH_COLOR, DIM_TEXT_COLOR, FONT_FAMILY } from '../../../shared';
import { type ClueState, type EdgeMark, type MazePuzzle, PASSAGE } from '../models';
import { createBoardGesturesViewModel, type DrawnMark } from './board-gestures-view-model';
import { type BoardLayout, layOutBoard, measureClueWidth, toClueLabels } from './board-layout';
import {
    CLUE_COLOR, DUST_LINE_COLOR, FLOOR_COLOR, FRAME_COLOR, GOLD_COLOR, GOLD_EDGE_COLOR, GOLD_GLOW_COLOR, HIDDEN_CLUE_COLOR, KEY_COLOR,
    THREAD_COLOR, THREAD_EDGE_COLOR, WALL_COLOR, WALL_EDGE_COLOR,
} from './view-constants';

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
    /** Whether `cell`'s marks break a rule, which hatches it in red. */
    isClashAt: (cell: number) => boolean;
    /** How `line`'s clue stands. A met clue fades, and a broken one shows in red. */
    clueStateAt: (line: number) => ClueState;
    /** Whether the maze is solved. As it becomes solved, every wall shows, the thread turns gold, and light runs along it. */
    isSolved: () => boolean;
    /** A count that rises with every change to the marks, so the board is redrawn only as they change. */
    changes: () => number;
    /** A count that rises as each puzzle opens, so a fresh copy of the same maze, started again, is redrawn too. */
    puzzlesOpened: () => number;
    /**
     * The player dragged over `edge`. A drag across it, from cell to cell,
     * draws the path, and a drag along it, from corner to corner, draws
     * walls. Without this binding, the board ignores the pointer.
     */
    onDraggedOver?: (edge: number, mark: DrawnMark) => void;
    /** The player let go, after dragging over an edge or more. */
    onDragFinished?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The maze and its clues, fitted into a space and centred in it, as a
 * labyrinth on Crete. You start in a maze you can't see, and you make it
 * visible as you work it out.
 *
 * The floor is sandstone. The walls you mark appear as terracotta blocks,
 * and the path is Ariadne's thread, a linen cord through the cells'
 * middles. The maze sits in an umber frame with a Greek key on it. The
 * start and the end are Α and Ω, alpha and omega, the first and last
 * letters of the Greek alphabet. A cell whose marks break a rule is hatched
 * in red.
 *
 * When you solve the maze, every wall shows, the thread turns gold, and a
 * gold light runs along it from Α to Ω, as you walk out.
 *
 * The clues are stacked above the maze and set out to its left, each at the
 * line it is for, with a tick on the frame. A hidden clue shows a blue `?`,
 * so you can spot the lines you have to work out without one.
 *
 * The board is drawn in layers, from the bottom up. The frame comes first,
 * then the floor, the light of a maze solved, the grid's lines and the
 * marks. The ends, the ticks and the clues are on top. The floor and the
 * marks are drawn again only as the marks change, and the light only as it
 * moves on.
 *
 * The gestures view model decides which edges a drag goes over, and
 * whoever the board reports to decides what the drag does to them. The
 * board itself only turns pointer events into positions in cells.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const view = new Container();
    view.label = 'board';
    const isInteractive = bindings.onDraggedOver !== undefined;
    if (isInteractive) view.cursor = 'crosshair';
    const watcher = watch({ changes: bindings.changes, isSolved: bindings.isSolved, opened: bindings.puzzlesOpened });

    // The maze shown, and what was built for it
    let maze: MazePuzzle | undefined;
    let layout: BoardLayout = layOutBoard({ rows: 1, cols: 1, clues: [], columnLineCount: 0, width: 1, height: 1 });
    let floor = new Graphics();
    let light = new Graphics();
    let marks = new Graphics();
    let clueTexts: Text[] = [];
    let clueLines: number[] = [];
    let gestures: GridGesturesViewModel | undefined;
    // The solution's cells, in order from the start, for the light to run along
    let pathCells: Int32Array = new Int32Array(0);
    // The light's time, from the moment the maze is solved, whether the maze shown is solved, and how many cells the light has reached
    let lightMs = 0;
    let isShowingSolved = false;
    let litCount = 0;
    build(bindings.maze());

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
        // The light runs along the thread from the moment the maze is solved
        const isSolved = bindings.isSolved();
        if (isSolved !== isShowingSolved) {
            isShowingSolved = isSolved;
            lightMs = 0;
        }
        if (isShowingSolved) lightMs += deltaMs;
    }

    function refresh(): void {
        const next = bindings.maze();
        if (next !== maze) build(next);
        const w = watcher.poll();
        if (w.changes.changed || w.isSolved.changed || w.opened.changed) drawMarks();
        drawLight();
    }

    /** Builds the board for `next`: its layout, its unchanging layers, and its clues. */
    function build(next: MazePuzzle): void {
        maze = next;
        const { grid } = next;
        const { rows, cols } = grid;
        layout = layOutBoard({ rows, cols, clues: next.clues, columnLineCount: grid.columnLineCount, width: bindings.width, height: bindings.height });
        const { cellSize, gridX, gridY, frameWidth } = layout;
        pathCells = listPathCells(next);

        for (const child of view.removeChildren()) child.destroy({ children: true });
        const frame = makeFrame(cols * cellSize, rows * cellSize);
        floor = new Graphics();
        light = new Graphics();
        const lines = new Graphics();
        for (let col = 1; col < cols; col++) lines.moveTo(gridX + col * cellSize, gridY).lineTo(gridX + col * cellSize, gridY + rows * cellSize);
        for (let row = 1; row < rows; row++) lines.moveTo(gridX, gridY + row * cellSize).lineTo(gridX + cols * cellSize, gridY + row * cellSize);
        lines.stroke({ color: DUST_LINE_COLOR, width: 1 });
        marks = new Graphics();
        // A tick outside the frame at each line with a clue, pointing to it
        const ticks = new Graphics();
        const tick = Math.max(4, cellSize * TICK_SHARE);
        for (let col = 1; col < cols; col++) ticks.moveTo(gridX + col * cellSize, gridY - frameWidth).lineTo(gridX + col * cellSize, gridY - frameWidth - tick);
        for (let row = 1; row < rows; row++) ticks.moveTo(gridX - frameWidth, gridY + row * cellSize).lineTo(gridX - frameWidth - tick, gridY + row * cellSize);
        ticks.stroke({ color: FRAME_COLOR, width: 1.5 });
        view.addChild(frame, floor, light, lines, marks, makeEnd(next.start, 'Α'), makeEnd(next.end, 'Ω'), ticks);
        makeClues(next);

        if (isInteractive) {
            const reach = cellSize * HIT_MARGIN;
            view.hitArea = new Rectangle(gridX - reach, gridY - reach, cols * cellSize + reach * 2, rows * cellSize + reach * 2);
            gestures = createBoardGesturesViewModel({
                grid,
                onDraggedOver: (edge, mark) => bindings.onDraggedOver?.(edge, mark),
                onDragFinished: () => bindings.onDragFinished?.(),
            });
        }
        // A maze solved already shows solved at once, with the light all the way along
        isShowingSolved = bindings.isSolved();
        lightMs = isShowingSolved ? LIGHT_MS : 0;
        litCount = 0;
        drawMarks();
        drawLight();
    }

    /** Returns the umber frame round a maze `width` by `height`, with a Greek key along each side and a square in each corner. */
    function makeFrame(width: number, height: number): Graphics {
        const { gridX, gridY, frameWidth } = layout;
        const frame = new Graphics().rect(gridX - frameWidth, gridY - frameWidth, width + frameWidth * 2, height + frameWidth * 2).fill(FRAME_COLOR);
        const pad = frameWidth * KEY_PAD_SHARE;
        const depth = frameWidth - pad * 2;
        // Each side, from its outer edge, with the key's baseline nearest the maze
        drawKey(frame, gridX, gridY - frameWidth + pad, 1, 0, 0, 1, width, depth);
        drawKey(frame, gridX, gridY + height + frameWidth - pad, 1, 0, 0, -1, width, depth);
        drawKey(frame, gridX - frameWidth + pad, gridY, 0, 1, 1, 0, height, depth);
        drawKey(frame, gridX + width + frameWidth - pad, gridY, 0, 1, -1, 0, height, depth);
        const corners = [gridX - frameWidth, gridX + width];
        const rowsOfCorners = [gridY - frameWidth, gridY + height];
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) frame.rect(corners[i] + pad, rowsOfCorners[j] + pad, depth, depth);
        }
        frame.stroke({ color: KEY_COLOR, width: Math.max(1, frameWidth * KEY_LINE_SHARE), join: 'miter' });
        return frame;
    }

    /** Returns an end of the path, an umber disc in `cell` with `letter` on it. */
    function makeEnd(cell: number, letter: string): Container {
        const { cellSize, gridX, gridY } = layout;
        const { cols } = maze!.grid;
        const end = new Container({ x: gridX + ((cell % cols) + 0.5) * cellSize, y: gridY + (Math.floor(cell / cols) + 0.5) * cellSize });
        const style = { fontFamily: FONT_FAMILY, fontSize: cellSize * END_LETTER_SHARE, fontWeight: '700', fill: FLOOR_COLOR } as const;
        const text = new Text({ text: letter, style });
        text.anchor.set(0.5);
        end.addChild(new Graphics().circle(0, 0, cellSize * END_SHARE).fill(FRAME_COLOR), text);
        return end;
    }

    /** Makes the clues' numbers. They're stacked above each line between columns, last nearest, and set out in a row left of each line between rows. */
    function makeClues(next: MazePuzzle): void {
        const { cellSize, gridX, gridY, clueSize, clueStep, clueGap } = layout;
        const style = { fontFamily: FONT_FAMILY, fontSize: clueSize, fontWeight: '600', fill: 0xffffff } as const;
        clueTexts = [];
        clueLines = [];
        for (let line = 0; line < next.clues.length; line++) {
            const labels = toClueLabels(next.clues[line]);
            const isAlongTop = line < next.grid.columnLineCount;
            let x = gridX - clueGap;
            for (let i = labels.length - 1; i >= 0; i--) {
                const text = new Text({ text: labels[i], style });
                if (isAlongTop) {
                    text.anchor.set(0.5);
                    text.position.set(gridX + (line + 1) * cellSize, gridY - clueGap - (labels.length - 1 - i) * clueStep - clueSize * 0.5);
                }
                else {
                    text.anchor.set(1, 0.5);
                    text.position.set(x, gridY + (line - next.grid.columnLineCount + 1) * cellSize);
                    // The label's width and a space, as the layout measures them
                    x -= measureClueWidth([labels[i], '0'], clueSize) - measureClueWidth(['0'], clueSize);
                }
                view.addChild(text);
                clueTexts.push(text);
                clueLines.push(line);
            }
        }
    }

    /** Draws the floor, the clashes, the walls and the thread as they stand, and tints the clues by how they stand. */
    function drawMarks(): void {
        const { grid } = maze!;
        const { cols, rows, cellCount } = grid;
        const { cellSize, gridX, gridY } = layout;
        const isSolved = bindings.isSolved();

        floor.clear();
        floor.rect(gridX, gridY, cols * cellSize, rows * cellSize).fill(FLOOR_COLOR);

        // A cell that breaks a rule is tinted and hatched, so it can't be mistaken for terracotta
        let hasClashes = false;
        for (let cell = 0; cell < cellCount; cell++) {
            if (isSolved || !bindings.isClashAt(cell)) continue;
            floor.rect(gridX + (cell % cols) * cellSize, gridY + Math.floor(cell / cols) * cellSize, cellSize, cellSize);
            hasClashes = true;
        }
        if (hasClashes) {
            floor.fill(CLASH_CELL_COLOR);
            for (let cell = 0; cell < cellCount; cell++) {
                if (!bindings.isClashAt(cell)) continue;
                const x = gridX + (cell % cols) * cellSize;
                const y = gridY + Math.floor(cell / cols) * cellSize;
                const half = cellSize / 2;
                floor.moveTo(x, y + cellSize).lineTo(x + cellSize, y);
                floor.moveTo(x, y + half).lineTo(x + half, y);
                floor.moveTo(x + half, y + cellSize).lineTo(x + cellSize, y + half);
            }
            floor.stroke({ color: CLASH_COLOR, width: Math.max(1.5, cellSize * HATCH_SHARE), alpha: HATCH_ALPHA });
        }

        // The walls are terracotta blocks with a darker edge. The thread is a cord with a darker edge, red until the maze
        // is solved and gold after. A stroke uses up its path, so each path is traced twice, once for the edge and once
        // for the core on top
        marks.clear();
        const wallWidth = Math.max(3, cellSize * WALL_SHARE);
        if (traceWalls(isSolved)) {
            marks.stroke({ color: WALL_EDGE_COLOR, width: wallWidth, cap: 'square' });
            traceWalls(isSolved);
            marks.stroke({ color: WALL_COLOR, width: wallWidth * WALL_FACE_SHARE, cap: 'square' });
        }
        const threadWidth = Math.max(3, cellSize * THREAD_SHARE);
        if (traceThread()) {
            marks.stroke({ color: isSolved ? GOLD_EDGE_COLOR : THREAD_EDGE_COLOR, width: threadWidth, cap: 'round', join: 'round' });
            traceThread();
            marks.stroke({ color: isSolved ? GOLD_COLOR : THREAD_COLOR, width: threadWidth * THREAD_CORE_SHARE, cap: 'round', join: 'round' });
        }

        for (let i = 0; i < clueTexts.length; i++) {
            const state = isSolved ? 'open' : bindings.clueStateAt(clueLines[i]);
            // A hidden clue's ? is always open, and shows in its own colour so it stands out from the numbers
            const openColor = maze!.clues[clueLines[i]] ? CLUE_COLOR : HIDDEN_CLUE_COLOR;
            clueTexts[i].tint = state === 'broken' ? CLASH_COLOR : state === 'met' ? DIM_TEXT_COLOR : openColor;
            clueTexts[i].alpha = state === 'met' ? MET_CLUE_ALPHA : 1;
        }
    }

    /** Traces the walls marked on `marks`, every edge but the passages once the maze is solved. Returns whether there were any. */
    function traceWalls(isSolved: boolean): boolean {
        const { grid } = maze!;
        const { cols, edgeCount, edgeCellA } = grid;
        const { cellSize, gridX, gridY } = layout;
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
        return hasWalls;
    }

    /** Traces the passages marked on `marks`, from the middle of one cell to the middle of the next. Returns whether there were any. */
    function traceThread(): boolean {
        const { cols, edgeCount, edgeCellA, edgeCellB } = maze!.grid;
        const { cellSize, gridX, gridY } = layout;
        let hasPassages = false;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (bindings.markAt(edge) !== 'passage') continue;
            const a = edgeCellA[edge];
            const b = edgeCellB[edge];
            marks.moveTo(gridX + ((a % cols) + 0.5) * cellSize, gridY + (Math.floor(a / cols) + 0.5) * cellSize);
            marks.lineTo(gridX + ((b % cols) + 0.5) * cellSize, gridY + (Math.floor(b / cols) + 0.5) * cellSize);
            hasPassages = true;
        }
        return hasPassages;
    }

    /** Lights the cells along the path, from the start, as far as the light has reached since the maze was solved. */
    function drawLight(): void {
        const { cellSize, gridX, gridY } = layout;
        const { cols, cellCount } = maze!.grid;
        const reached = isShowingSolved ? Math.min(cellCount, Math.floor((lightMs / LIGHT_MS) * cellCount) + 1) : 0;
        if (reached < litCount) {
            light.clear();
            litCount = 0;
        }
        // Each cell the light reaches is added to what is drawn already
        for (; litCount < reached; litCount++) {
            const cell = pathCells[litCount];
            light.rect(gridX + (cell % cols) * cellSize, gridY + Math.floor(cell / cols) * cellSize, cellSize, cellSize).fill(LIGHT_FILL);
        }
    }

    /** Where a point on the board is on the maze, in cells, across and down from its top left corner. */
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

/** A wall's width, the thread's, the ticks on the frame, a clash's hatching, the ends' discs' radius and their letters' size, each as a share of a cell. */
const WALL_SHARE = 0.11;
const THREAD_SHARE = 0.14;
const TICK_SHARE = 0.14;
const HATCH_SHARE = 0.045;
const END_SHARE = 0.29;
const END_LETTER_SHARE = 0.36;
/** How much of a wall's width is its terracotta face, inside its darker edge, and how much of the thread's is its bright core. */
const WALL_FACE_SHARE = 0.6;
const THREAD_CORE_SHARE = 0.6;
/** How strong a clash's hatching is. */
const HATCH_ALPHA = 0.75;
/** How far past the maze's border a press still counts, as a share of a cell, so a wall can be drawn from a corner of the border. */
const HIT_MARGIN = 0.45;
/** How faint a clue met is. */
const MET_CLUE_ALPHA = 0.55;
/** How long the light takes to run the whole path once the maze is solved, in ms, whatever the maze's size, and how it fills each cell. */
const LIGHT_MS = 1200;
const LIGHT_FILL = { color: GOLD_GLOW_COLOR, alpha: 0.7 } as const;
/** The Greek key's margin inside the frame, and its line's width, each as a share of the frame's width. */
const KEY_PAD_SHARE = 0.2;
const KEY_LINE_SHARE = 0.1;
/**
 * One turn of the Greek key, as points on an 8 by 8 square, x along the
 * frame and y across it, from its outer edge to the maze. A line climbs
 * from the baseline, hooks back on itself, and comes down to the baseline,
 * which runs on to the next turn. One hook a turn keeps the key clear at
 * the small sizes a frame is drawn at.
 */
const KEY_TURN: readonly number[] = [0, 8, 0, 0, 6, 0, 6, 5, 3, 5, 3, 8, 8, 8];
const KEY_TURN_SIZE = 8;

/**
 * Draws a Greek key along one side of the frame, as a path on `g`. The key
 * starts at (`x`, `y`), on its outer edge. It runs `length` along the
 * direction (`alongX`, `alongY`), and reaches `depth` across the frame, in
 * the direction (`acrossX`, `acrossY`). The turns are stretched a little,
 * so that a whole number of them fits.
 */
function drawKey(
    g: Graphics, x: number, y: number, alongX: number, alongY: number, acrossX: number, acrossY: number, length: number, depth: number,
): void {
    const turnCount = Math.max(1, Math.round(length / depth));
    const turnLength = length / turnCount;
    for (let turn = 0; turn < turnCount; turn++) {
        for (let i = 0; i < KEY_TURN.length; i += 2) {
            const along = turn * turnLength + (KEY_TURN[i] / KEY_TURN_SIZE) * turnLength;
            const across = (KEY_TURN[i + 1] / KEY_TURN_SIZE) * depth;
            const px = x + alongX * along + acrossX * across;
            const py = y + alongY * along + acrossY * across;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
        }
    }
}

/** The solution's cells, in order along the path from the start to the end. */
function listPathCells(maze: MazePuzzle): Int32Array {
    const { grid, start, solution } = maze;
    const cells = new Int32Array(grid.cellCount);
    let previous = -1;
    let cell = start;
    for (let i = 0; i < grid.cellCount; i++) {
        cells[i] = cell;
        let next = -1;
        for (let side = 0; side < 4 && next < 0; side++) {
            const edge = grid.cellEdges[cell * 4 + side];
            if (edge < 0 || solution[edge] !== PASSAGE) continue;
            const other = grid.edgeCellA[edge] === cell ? grid.edgeCellB[edge] : grid.edgeCellA[edge];
            if (other !== previous) next = other;
        }
        previous = cell;
        cell = next;
    }
    return cells;
}
