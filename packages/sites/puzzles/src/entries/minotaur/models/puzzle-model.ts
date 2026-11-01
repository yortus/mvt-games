import { PASSAGE, UNKNOWN, WALL } from './edge-states';
import { createLinePattern, type LinePattern } from './line-pattern';
import type { MazePuzzle } from './make-maze-puzzle';
import { MOST_UNDOS } from './model-constants';
import { type PuzzleSave, readPuzzleSave, writePuzzleSave } from './puzzle-save';
import { createUndoHistory } from './undo-history';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the player has marked an edge as: nothing yet, a passage the path goes through, or a wall. */
export type EdgeMark = 'unknown' | 'passage' | 'wall';

/** How a line's clue stands: still open, met by the walls marked on its line, or broken by them. */
export type ClueState = 'open' | 'met' | 'broken';

/**
 * One maze being solved: the marks the player has made on its edges. The
 * player marks edges as passages or walls, a stroke at a time, and the
 * puzzle is solved once the passages are its solution's. Every stroke can
 * be undone, back to the start of the visit. Once the puzzle is solved, it
 * takes no more marks.
 *
 * It points out what breaks a rule, as the marks are made: a cell with too
 * many passages, or too many walls to be passed through, and the cells of a
 * loop. A clue is met when the walls marked on its line make it exactly,
 * and broken when they can no longer fit it.
 */
export interface PuzzleModel {
    /** The maze being solved. */
    readonly maze: MazePuzzle;
    readonly markAt: (edge: number) => EdgeMark;
    /** Whether `cell`'s marks break a rule. */
    readonly isClashAt: (cell: number) => boolean;
    /** How `line`'s clue stands. */
    readonly clueStateAt: (line: number) => ClueState;
    /** Whether the passages marked are the solution's. */
    readonly isSolved: boolean;
    /** How many strokes undo can take back. */
    readonly undoCount: number;
    /** A count that rises with every mark and every undo, so that progress can be kept, and the maze redrawn, as it changes. */
    readonly changes: number;
    /** Passages and walls marked, marks taken off, marks that broke a rule, and strokes undone, since the puzzle opened. */
    readonly passagesMarked: number;
    readonly wallsMarked: number;
    readonly marksCleared: number;
    readonly clashesMade: number;
    readonly undosDone: number;
    /** Passages marked in the stroke being made, or the last one. */
    readonly strokePassages: number;
    /** The edge marked last, or -1. */
    readonly lastMarkedEdge: number;

    /** Starts a stroke: the marks until it finishes are undone together. */
    startStroke: () => void;
    /** Marks `edge`, as part of the stroke being made, or as a stroke of its own if none is. */
    mark: (edge: number, mark: EdgeMark) => void;
    finishStroke: () => void;
    /** Takes back the last stroke. */
    undo: () => void;
    /** Returns the puzzle as it stands, to be restored later through the options' `saved`. */
    save: () => PuzzleSave;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PuzzleModelOptions {
    readonly maze: MazePuzzle;
    /**
     * A save of this puzzle, from `save`, maybe from a visit before. It is
     * read from storage, so it is checked first. One that is not a save of
     * this maze is ignored, and the puzzle starts afresh.
     */
    readonly saved?: unknown;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a puzzle with nothing marked, or as it was saved. */
export function createPuzzleModel(options: PuzzleModelOptions): PuzzleModel {
    const { maze } = options;
    const { grid, start, end, solution } = maze;
    const { cellCount, edgeCount, cellEdges, edgeCellA, edgeCellB, lineEdges } = grid;
    const marks = readPuzzleSave(options.saved, maze) ?? new Uint8Array(edgeCount);
    const history = createUndoHistory({ marks, mostUndos: MOST_UNDOS });
    const patterns: LinePattern[] = maze.clues.map((clue, line) => createLinePattern({ clue, length: lineEdges[line].length }));
    const passagesNeeded = new Uint8Array(cellCount).fill(2);
    passagesNeeded[start] = 1;
    passagesNeeded[end] = 1;

    // What the marks mean, worked out as they change, since views ask about them every frame
    const clashes = new Uint8Array(cellCount);
    const clueStates: ClueState[] = maze.clues.map(() => 'open');
    const piece = new Int32Array(cellCount);
    const pieceCells = new Int32Array(cellCount);
    const piecePassages = new Int32Array(cellCount);
    let clashCount = 0;
    let isSolved = false;

    let isStroking = false;
    let changes = 0;
    let passagesMarked = 0;
    let wallsMarked = 0;
    let marksCleared = 0;
    let clashesMade = 0;
    let undosDone = 0;
    let strokePassages = 0;
    let lastMarkedEdge = -1;
    findWhatMarksMean();

    const model: PuzzleModel = {
        maze,
        markAt: (edge) => MARK_NAMES[marks[edge]],
        isClashAt: (cell) => clashes[cell] === 1,
        clueStateAt: (line) => clueStates[line],
        get isSolved() { return isSolved; },
        get undoCount() { return history.count; },
        get changes() { return changes; },
        get passagesMarked() { return passagesMarked; },
        get wallsMarked() { return wallsMarked; },
        get marksCleared() { return marksCleared; },
        get clashesMade() { return clashesMade; },
        get undosDone() { return undosDone; },
        get strokePassages() { return strokePassages; },
        get lastMarkedEdge() { return lastMarkedEdge; },
        startStroke() {
            if (isStroking || isSolved) return;
            isStroking = true;
            strokePassages = 0;
            history.start();
        },
        mark(edge, mark) {
            const state = MARK_STATES[mark];
            if (isSolved || edge < 0 || edge >= edgeCount || marks[edge] === state) return;
            const isOwnStroke = !isStroking;
            if (isOwnStroke) model.startStroke();
            history.keepEdge(edge);
            marks[edge] = state;
            lastMarkedEdge = edge;
            if (state === PASSAGE) {
                passagesMarked++;
                strokePassages++;
            }
            else if (state === WALL) wallsMarked++;
            else marksCleared++;
            const clashesBefore = clashCount;
            findWhatMarksMean();
            if (clashCount > clashesBefore) clashesMade++;
            changes++;
            if (isOwnStroke) model.finishStroke();
        },
        finishStroke() {
            if (!isStroking) return;
            isStroking = false;
            history.finish();
        },
        undo() {
            if (isSolved) return;
            model.finishStroke();
            if (history.undo() === undefined) return;
            findWhatMarksMean();
            undosDone++;
            changes++;
        },
        save: () => writePuzzleSave(maze, marks),
    };
    return model;

    /** Works out the clashes, the clues' states, and whether the maze is solved, from the marks. */
    function findWhatMarksMean(): void {
        findClashes();
        for (let line = 0; line < patterns.length; line++) clueStates[line] = findClueState(line);
        isSolved = true;
        for (let edge = 0; edge < edgeCount && isSolved; edge++) {
            if ((marks[edge] === PASSAGE) !== (solution[edge] === PASSAGE)) isSolved = false;
        }
    }

    function findClashes(): void {
        clashes.fill(0);
        // A cell with more passages than it needs, or too many walls (counting the border) to be passed through
        for (let cell = 0; cell < cellCount; cell++) {
            let passages = 0;
            let walls = 0;
            for (let side = 0; side < 4; side++) {
                const edge = cellEdges[cell * 4 + side];
                if (edge < 0 || marks[edge] === WALL) walls++;
                else if (marks[edge] === PASSAGE) passages++;
            }
            if (passages > passagesNeeded[cell] || walls > 4 - passagesNeeded[cell]) clashes[cell] = 1;
        }
        // The cells of a piece of the path with a loop in it: as many passages as cells, or more
        for (let cell = 0; cell < cellCount; cell++) piece[cell] = cell;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (marks[edge] === PASSAGE) piece[findPiece(edgeCellA[edge])] = findPiece(edgeCellB[edge]);
        }
        pieceCells.fill(0);
        piecePassages.fill(0);
        for (let cell = 0; cell < cellCount; cell++) pieceCells[findPiece(cell)]++;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (marks[edge] === PASSAGE) piecePassages[findPiece(edgeCellA[edge])]++;
        }
        clashCount = 0;
        for (let cell = 0; cell < cellCount; cell++) {
            const root = findPiece(cell);
            if (piecePassages[root] >= pieceCells[root]) clashes[cell] = 1;
            clashCount += clashes[cell];
        }
    }

    function findPiece(cell: number): number {
        let root = cell;
        while (piece[root] !== root) root = piece[root];
        while (piece[cell] !== root) {
            const next = piece[cell];
            piece[cell] = root;
            cell = next;
        }
        return root;
    }

    /** Met if the walls marked on the line are exactly its clue, broken if they can't fit it, and open otherwise. */
    function findClueState(line: number): ClueState {
        const edges = lineEdges[line];
        if (!patterns[line].fits(marks, edges)) return 'broken';
        const clue = maze.clues[line];
        let runIndex = 0;
        let run = 0;
        for (let i = 0; i <= edges.length; i++) {
            if (i < edges.length && marks[edges[i]] === WALL) {
                run++;
                continue;
            }
            if (run === 0) continue;
            if (runIndex >= clue.length || clue[runIndex] !== run) return 'open';
            runIndex++;
            run = 0;
        }
        return runIndex === clue.length ? 'met' : 'open';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MARK_NAMES: readonly EdgeMark[] = ['unknown', 'passage', 'wall'];
const MARK_STATES: Readonly<Record<EdgeMark, number>> = { unknown: UNKNOWN, passage: PASSAGE, wall: WALL };
