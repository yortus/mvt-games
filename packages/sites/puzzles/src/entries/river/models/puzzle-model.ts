import { findPiece } from './find-piece';
import { GIVEN_DRY, isGivenRiver, NO_GIVEN } from './given-pieces';
import { MOST_UNDOS } from './model-constants';
import { type PuzzleMarks, type PuzzleSave, readPuzzleSave, writePuzzleSave } from './puzzle-save';
import type { RiverPuzzle } from './river-puzzle';
import { RIVER } from './river-states';
import { createUndoHistory } from './undo-history';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The status of a row's or column's number. It is `open` while the river
 * could still meet it. It is `met` when the river cells drawn on the line
 * match it, and `broken` when the line has too many river cells or too
 * little room left.
 */
export type ClueState = 'open' | 'met' | 'broken';

/**
 * One valley being solved. The player draws the river across its edges,
 * and marks cells as meadow, which is their note that the river doesn't
 * pass through them. The givens are the pieces of river and the dry land
 * printed on the valley. They are marks from the start, and they never
 * change. Neither do the edges round them. The puzzle is solved once the
 * river drawn matches its solution. The player draws a stroke at a time,
 * and undo reverses a whole stroke. The last `MOST_UNDOS` strokes can be
 * undone, as far back as when the puzzle opened. Once the puzzle is solved,
 * it ignores every action.
 *
 * It points out each cell that breaks a rule as the marks are made. A cell
 * breaks a rule if it has more river sides than it can have, or if the
 * river runs through it and it is marked as meadow. Each cell of a loop
 * breaks a rule too.
 */
export interface PuzzleModel {
    /** The puzzle being solved. */
    readonly puzzle: RiverPuzzle;
    /** Whether the river is drawn across `edge`, given or the player's. */
    readonly isRiverAt: (edge: number) => boolean;
    /** Whether `cell` is marked as meadow, given or the player's. */
    readonly isMeadowAt: (cell: number) => boolean;
    /** Whether `cell` is a given, which is a piece of river or dry land printed on the valley. The player can't change it. */
    readonly isGivenAt: (cell: number) => boolean;
    /** Whether `edge` touches a given cell, so the player can't change it. */
    readonly isEdgeFixedAt: (edge: number) => boolean;
    /** Whether `cell` breaks a rule. */
    readonly isClashAt: (cell: number) => boolean;
    /** The status of the number of `line`. The rows come first, from the top, then the columns, from the left. */
    readonly clueStateAt: (line: number) => ClueState;
    /** Whether the river drawn matches the solution. */
    readonly isSolved: boolean;
    /** How many strokes can be undone. */
    readonly undoCount: number;
    /** A count that rises with every mark and every undo, so a change to the marks can be noticed. */
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
    /** The cell marked last, or the first cell beside the edge marked last. It is -1 until the first mark. */
    readonly lastMarkedCell: number;

    /** Starts a stroke. Undo reverses all the marks made until the stroke finishes, together. */
    startStroke: () => void;
    /** Draws the river across `edge`, or rubs it out, as part of the stroke being made, or as a stroke of its own when the player isn't making one. Ignores an edge that is fixed. */
    setRiver: (edge: number, isRiver: boolean) => void;
    /** Marks `cell` as meadow, or removes the mark, as part of the stroke being made, or as a stroke of its own when the player isn't making one. Ignores a given. */
    setMeadow: (cell: number, isMeadow: boolean) => void;
    /** Finishes the stroke being made. A stroke that leaves the marks as they were before it isn't kept for undo. */
    finishStroke: () => void;
    /** Reverses the last stroke, if there is one. */
    undo: () => void;
    /** Returns the marks as they stand, as plain values that the options' `saved` can restore later. */
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
     * this puzzle is ignored, and the puzzle starts afresh. The marks on the
     * givens, and on the edges round them, are set from the givens, whatever
     * the save says. The player can't change those marks, so a save that
     * disagreed with them would leave a puzzle that can't be solved.
     */
    readonly saved?: unknown;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a puzzle with only its givens drawn, or as it was saved. */
export function createPuzzleModel(options: PuzzleModelOptions): PuzzleModel {
    const { puzzle } = options;
    const { grid, spring, sea, rowCounts, colCounts, givens, solutionEdges } = puzzle;
    const { size, cellCount, edgeCount, edgeCellA, edgeCellB, cellEdges } = grid;
    let marks: PuzzleMarks = readPuzzleSave(options.saved, puzzle) ?? { rivers: new Uint8Array(edgeCount), meadows: new Uint8Array(cellCount) };
    markGivens();
    const history = createUndoHistory<PuzzleMarks>({ mostUndos: MOST_UNDOS });
    const isFixed = new Uint8Array(edgeCount);
    for (let edge = 0; edge < edgeCount; edge++) {
        if (givens[edgeCellA[edge]] !== NO_GIVEN || givens[edgeCellB[edge]] !== NO_GIVEN) isFixed[edge] = 1;
    }

    // Work out what the marks mean each time they change, because views read the results every tick
    const clashes = new Uint8Array(cellCount);
    const clueStates: ClueState[] = new Array<ClueState>(size * 2).fill('open');
    const piece = new Int32Array(cellCount);
    const pieceCells = new Int32Array(cellCount);
    const pieceEdges = new Int32Array(cellCount);
    let clashCount = 0;
    let isSolved = false;

    // The marks as they were before the stroke being made, or undefined between strokes
    let strokeBefore: PuzzleMarks | undefined;

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
        },
        setRiver(edge, isRiver) {
            const mark = isRiver ? 1 : 0;
            if (isSolved || edge < 0 || edge >= edgeCount || isFixed[edge] === 1 || marks.rivers[edge] === mark) return;
            const isOwnStroke = strokeBefore === undefined;
            if (isOwnStroke) model.startStroke();
            marks.rivers[edge] = mark;
            lastMarkedCell = edgeCellA[edge];
            if (isRiver) riverDrawn++;
            else riverCleared++;
            noteChange();
            if (isOwnStroke) model.finishStroke();
        },
        setMeadow(cell, isMeadow) {
            const mark = isMeadow ? 1 : 0;
            if (isSolved || cell < 0 || cell >= cellCount || givens[cell] !== NO_GIVEN || marks.meadows[cell] === mark) return;
            const isOwnStroke = strokeBefore === undefined;
            if (isOwnStroke) model.startStroke();
            marks.meadows[cell] = mark;
            lastMarkedCell = cell;
            if (isMeadow) meadowsMarked++;
            else meadowsCleared++;
            noteChange();
            if (isOwnStroke) model.finishStroke();
        },
        finishStroke() {
            if (strokeBefore === undefined) return;
            // A stroke that rubbed out all it drew isn't kept, so that each undo changes the marks
            if (!isSameMarks(strokeBefore, marks)) history.keep(strokeBefore);
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

    /**
     * Sets the marks on each given cell, and on the edges round it, from the
     * givens. The river runs through each given piece, and each given dry
     * cell is marked as meadow.
     */
    function markGivens(): void {
        for (let cell = 0; cell < cellCount; cell++) {
            const given = givens[cell];
            if (given === NO_GIVEN) continue;
            marks.meadows[cell] = given === GIVEN_DRY ? 1 : 0;
            for (let side = 0; side < 4; side++) {
                const edge = cellEdges[cell * 4 + side];
                if (edge >= 0) marks.rivers[edge] = isGivenRiver(given) && (given >> side) & 1 ? 1 : 0;
            }
        }
    }

    /** Works out what a mark just made means, and counts it. */
    function noteChange(): void {
        const clashesBefore = clashCount;
        findWhatMarksMean();
        if (clashCount > clashesBefore) clashesMade++;
        changes++;
    }

    /** Works out the clashes, the numbers' states, and whether the puzzle is solved, from the marks. */
    function findWhatMarksMean(): void {
        clashes.fill(0);
        // Find each cell with more river sides than it can have, or with river through a meadow
        for (let cell = 0; cell < cellCount; cell++) {
            const rivers = countRiverSides(cell);
            const most = cell === spring || cell === sea ? 1 : 2;
            if (rivers > most || (rivers > 0 && marks.meadows[cell] === 1)) clashes[cell] = 1;
        }
        // Find the cells of each stretch of river with a loop in it. A stretch has a loop if it has as many river edges as cells, or more
        for (let cell = 0; cell < cellCount; cell++) piece[cell] = cell;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (marks.rivers[edge] === 1) piece[findPiece(piece, edgeCellA[edge])] = findPiece(piece, edgeCellB[edge]);
        }
        pieceCells.fill(0);
        pieceEdges.fill(0);
        for (let cell = 0; cell < cellCount; cell++) pieceCells[findPiece(piece, cell)]++;
        for (let edge = 0; edge < edgeCount; edge++) {
            if (marks.rivers[edge] === 1) pieceEdges[findPiece(piece, edgeCellA[edge])]++;
        }
        clashCount = 0;
        for (let cell = 0; cell < cellCount; cell++) {
            const root = findPiece(piece, cell);
            if (pieceEdges[root] > 0 && pieceEdges[root] >= pieceCells[root]) clashes[cell] = 1;
            clashCount += clashes[cell];
        }
        for (let line = 0; line < size * 2; line++) clueStates[line] = findClueState(line);
        isSolved = true;
        for (let edge = 0; edge < edgeCount && isSolved; edge++) {
            if ((marks.rivers[edge] === 1) !== (solutionEdges[edge] === RIVER)) isSolved = false;
        }
    }

    /** Returns how many of `cell`'s sides the river is drawn across. */
    function countRiverSides(cell: number): number {
        let rivers = 0;
        for (let side = 0; side < 4; side++) {
            const edge = cellEdges[cell * 4 + side];
            if (edge >= 0 && marks.rivers[edge] === 1) rivers++;
        }
        return rivers;
    }

    /**
     * Returns `met` if the river cells drawn on the line match its number,
     * `broken` if the line has too many or too little room left, and `open`
     * otherwise.
     */
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
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns whether `a` and `b` hold the same marks. */
function isSameMarks(a: PuzzleMarks, b: PuzzleMarks): boolean {
    for (let edge = 0; edge < a.rivers.length; edge++) {
        if (a.rivers[edge] !== b.rivers[edge]) return false;
    }
    for (let cell = 0; cell < a.meadows.length; cell++) {
        if (a.meadows[cell] !== b.meadows[cell]) return false;
    }
    return true;
}
