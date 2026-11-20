import { GIVEN_DRY, isGivenRiver, NO_GIVEN } from './given-pieces';
import { MOST_UNDOS } from './model-constants';
import { type PuzzleMarks, type PuzzleSave, readPuzzleSave, writePuzzleSave } from './puzzle-save';
import type { RiverPuzzle } from './river-puzzle';
import { RIVER } from './river-states';
import { createUndoHistory } from './undo-history';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How a row's or column's number stands: still open, met by the river cells drawn on it, or broken, with too many, or too little room left. */
export type ClueState = 'open' | 'met' | 'broken';

/**
 * One valley being solved: the river the player has drawn across its edges,
 * and the cells they have marked as meadow, their note that the river keeps
 * away. Its givens, the pieces of river and the dry land printed on it, are
 * marks from the start, which never change, and neither do the edges round
 * them. The puzzle is solved once the river is its solution's. The player
 * draws a stroke at a time, and each stroke is undone as one. The last
 * `MOST_UNDOS` strokes can be undone, as far back as when the puzzle opened.
 * Once the puzzle is solved, it ignores every action.
 *
 * It points out what breaks a rule, as the marks are made: a cell with more
 * river sides than it can have, river through a meadow, and the cells of a
 * loop.
 */
export interface PuzzleModel {
    /** The puzzle being solved. */
    readonly puzzle: RiverPuzzle;
    /** Whether the river is drawn across `edge`, given or the player's. */
    readonly isRiverAt: (edge: number) => boolean;
    /** Whether `cell` is marked as meadow, given or the player's. */
    readonly isMeadowAt: (cell: number) => boolean;
    /** Whether `cell` is a given: a piece of river or dry land printed on the valley, which the player can't change. */
    readonly isGivenAt: (cell: number) => boolean;
    /** Whether `edge` touches a given cell, so the player can't change it. */
    readonly isEdgeFixedAt: (edge: number) => boolean;
    /** Whether `cell` breaks a rule. */
    readonly isClashAt: (cell: number) => boolean;
    /** How the number of `line` stands: the rows from the top, then the columns from the left. */
    readonly clueStateAt: (line: number) => ClueState;
    /** Whether the river drawn is the solution's. */
    readonly isSolved: boolean;
    /** How many strokes undo can take back. */
    readonly undoCount: number;
    /** A count that rises with every mark and every undo, so that progress can be kept, and the valley redrawn, as it changes. */
    readonly changes: number;
    /** Edges the river was drawn across since the puzzle opened. */
    readonly riverDrawn: number;
    /** Edges the river was rubbed out from since the puzzle opened. */
    readonly riverCleared: number;
    /** Cells marked as meadow since the puzzle opened. */
    readonly meadowsMarked: number;
    /** Meadow marks taken off since the puzzle opened. */
    readonly meadowsCleared: number;
    /** Marks that made more cells break a rule, since the puzzle opened. */
    readonly clashesMade: number;
    /** Strokes undone since the puzzle opened. */
    readonly undosDone: number;
    /** The cell marked last, or the first cell beside the edge marked last, or -1. */
    readonly lastMarkedCell: number;

    /** Starts a stroke: the marks until it finishes are undone together. */
    startStroke: () => void;
    /** Draws the river across `edge`, or rubs it out, as part of the stroke being made, or as a stroke of its own if none is. Ignores an edge that is fixed. */
    setRiver: (edge: number, isRiver: boolean) => void;
    /** Marks `cell` as meadow, or removes the mark, as a stroke of its own. Ignores a given. */
    setMeadow: (cell: number, isMeadow: boolean) => void;
    /** Finishes the stroke being made. */
    finishStroke: () => void;
    /** Takes back the last stroke, if there is one. */
    undo: () => void;
    /** Returns the puzzle as it stands, to be restored later through the options' `saved`. */
    save: () => PuzzleSave;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a puzzle model is created with. */
export interface PuzzleModelOptions {
    /** The puzzle to solve. */
    readonly puzzle: RiverPuzzle;
    /**
     * A save of this puzzle, from `save`, maybe from a visit before. It is
     * read from storage, so it is checked first. One that is not a save of
     * this puzzle is ignored, and the puzzle starts afresh.
     */
    readonly saved?: unknown;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a puzzle with nothing drawn but its givens, or as it was saved. */
export function createPuzzleModel(options: PuzzleModelOptions): PuzzleModel {
    const { puzzle } = options;
    const { grid, spring, sea, rowCounts, colCounts, givens, solutionEdges } = puzzle;
    const { size, cellCount, edgeCount, edgeCellA, edgeCellB, cellEdges } = grid;
    let marks: PuzzleMarks = readPuzzleSave(options.saved, puzzle) ?? createGivenMarks();
    const history = createUndoHistory<PuzzleMarks>({ mostUndos: MOST_UNDOS });
    const isFixed = new Uint8Array(edgeCount);
    for (let edge = 0; edge < edgeCount; edge++) {
        if (givens[edgeCellA[edge]] !== NO_GIVEN || givens[edgeCellB[edge]] !== NO_GIVEN) isFixed[edge] = 1;
    }

    // What the marks mean, worked out as they change, since views ask about them every frame
    const clashes = new Uint8Array(cellCount);
    const clueStates: ClueState[] = new Array<ClueState>(size * 2).fill('open');
    const piece = new Int32Array(cellCount);
    const pieceCells = new Int32Array(cellCount);
    const pieceEdges = new Int32Array(cellCount);
    let clashCount = 0;
    let isSolved = false;

    // The stroke being made: the marks before it, and whether it changed any
    let strokeBefore: PuzzleMarks | undefined;
    let isStrokeChanged = false;

    let changes = 0;
    let riverDrawn = 0;
    let riverCleared = 0;
    let meadowsMarked = 0;
    let meadowsCleared = 0;
    let clashesMade = 0;
    let undosDone = 0;
    let lastMarkedCell = -1;
    findWhatMarksMean();

    const model: PuzzleModel = {
        puzzle,
        isRiverAt: (edge) => marks.rivers[edge] === 1,
        isMeadowAt: (cell) => marks.meadows[cell] === 1,
        isGivenAt: (cell) => givens[cell] !== NO_GIVEN,
        isEdgeFixedAt: (edge) => isFixed[edge] === 1,
        isClashAt: (cell) => clashes[cell] === 1,
        clueStateAt: (line) => clueStates[line],
        get isSolved() { return isSolved; },
        get undoCount() { return history.count; },
        get changes() { return changes; },
        get riverDrawn() { return riverDrawn; },
        get riverCleared() { return riverCleared; },
        get meadowsMarked() { return meadowsMarked; },
        get meadowsCleared() { return meadowsCleared; },
        get clashesMade() { return clashesMade; },
        get undosDone() { return undosDone; },
        get lastMarkedCell() { return lastMarkedCell; },
        startStroke() {
            if (strokeBefore !== undefined || isSolved) return;
            strokeBefore = { rivers: marks.rivers.slice(), meadows: marks.meadows.slice() };
            isStrokeChanged = false;
        },
        setRiver(edge, isRiver) {
            const state = isRiver ? 1 : 0;
            if (isSolved || edge < 0 || edge >= edgeCount || isFixed[edge] === 1 || marks.rivers[edge] === state) return;
            const isOwnStroke = strokeBefore === undefined;
            if (isOwnStroke) model.startStroke();
            marks.rivers[edge] = state;
            lastMarkedCell = edgeCellA[edge];
            if (isRiver) riverDrawn++;
            else riverCleared++;
            noteChange();
            if (isOwnStroke) model.finishStroke();
        },
        setMeadow(cell, isMeadow) {
            const state = isMeadow ? 1 : 0;
            if (isSolved || cell < 0 || cell >= cellCount || givens[cell] !== NO_GIVEN || marks.meadows[cell] === state) return;
            const isOwnStroke = strokeBefore === undefined;
            if (isOwnStroke) model.startStroke();
            marks.meadows[cell] = state;
            lastMarkedCell = cell;
            if (isMeadow) meadowsMarked++;
            else meadowsCleared++;
            noteChange();
            if (isOwnStroke) model.finishStroke();
        },
        finishStroke() {
            if (strokeBefore === undefined) return;
            if (isStrokeChanged) history.keep(strokeBefore);
            strokeBefore = undefined;
        },
        undo() {
            if (isSolved) return;
            model.finishStroke();
            const before = history.takeBack();
            if (before === undefined) return;
            marks = before;
            findWhatMarksMean();
            undosDone++;
            changes++;
        },
        save: () => writePuzzleSave(puzzle, marks),
    };
    return model;

    /** The marks a puzzle starts with: the river through each given piece, and meadow on each given dry cell. */
    function createGivenMarks(): PuzzleMarks {
        const rivers = new Uint8Array(edgeCount);
        const meadows = new Uint8Array(cellCount);
        for (let cell = 0; cell < cellCount; cell++) {
            if (givens[cell] === GIVEN_DRY) meadows[cell] = 1;
            if (!isGivenRiver(givens[cell])) continue;
            for (let side = 0; side < 4; side++) {
                const edge = cellEdges[cell * 4 + side];
                if (edge >= 0 && (givens[cell] >> side) & 1) rivers[edge] = 1;
            }
        }
        return { rivers, meadows };
    }

    /** Works out what a mark just made means, and counts it. */
    function noteChange(): void {
        isStrokeChanged = true;
        const clashesBefore = clashCount;
        findWhatMarksMean();
        if (clashCount > clashesBefore) clashesMade++;
        changes++;
    }

    /** Works out the clashes, the numbers' states, and whether the puzzle is solved, from the marks. */
    function findWhatMarksMean(): void {
        clashes.fill(0);
        // A cell with more river sides than it can have, or river through a meadow
        for (let cell = 0; cell < cellCount; cell++) {
            const rivers = countRiverSides(cell);
            const most = cell === spring || cell === sea ? 1 : 2;
            if (rivers > most || (rivers > 0 && marks.meadows[cell] === 1)) clashes[cell] = 1;
        }
        // The cells of a stretch of river with a loop in it: as many river edges as cells, or more
        for (let cell = 0; cell < cellCount; cell++) piece[cell] = cell;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (marks.rivers[edge] === 1) piece[findPiece(edgeCellA[edge])] = findPiece(edgeCellB[edge]);
        }
        pieceCells.fill(0);
        pieceEdges.fill(0);
        for (let cell = 0; cell < cellCount; cell++) pieceCells[findPiece(cell)]++;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (marks.rivers[edge] === 1) pieceEdges[findPiece(edgeCellA[edge])]++;
        }
        clashCount = 0;
        for (let cell = 0; cell < cellCount; cell++) {
            const root = findPiece(cell);
            if (pieceEdges[root] > 0 && pieceEdges[root] >= pieceCells[root]) clashes[cell] = 1;
            clashCount += clashes[cell];
        }
        for (let line = 0; line < size * 2; line++) clueStates[line] = findClueState(line);
        isSolved = true;
        for (let edge = 0; edge < edgeCount && isSolved; edge++) {
            if ((marks.rivers[edge] === 1) !== (solutionEdges[edge] === RIVER)) isSolved = false;
        }
    }

    function countRiverSides(cell: number): number {
        let rivers = 0;
        for (let side = 0; side < 4; side++) {
            const edge = cellEdges[cell * 4 + side];
            if (edge >= 0 && marks.rivers[edge] === 1) rivers++;
        }
        return rivers;
    }

    /** Met if the river cells drawn on the line are its number, broken if there are too many or too little room left, and open otherwise. */
    function findClueState(line: number): ClueState {
        const isColumn = line >= size;
        const index = isColumn ? line - size : line;
        const count = isColumn ? colCounts[index] : rowCounts[index];
        let rivers = 0;
        let open = 0;
        for (let i = 0; i < size; i++) {
            const cell = isColumn ? i * size + index : index * size + i;
            if (cell === spring || cell === sea || countRiverSides(cell) > 0) rivers++;
            else if (marks.meadows[cell] === 0) open++;
        }
        if (rivers > count || rivers + open < count) return 'broken';
        return rivers === count ? 'met' : 'open';
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
}
