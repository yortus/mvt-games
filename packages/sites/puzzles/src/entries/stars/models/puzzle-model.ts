import { STAR, STARS_PER_LINE } from './cell-states';
import { MOST_UNDOS } from './model-constants';
import { type PuzzleSave, readPuzzleSave, writePuzzleSave } from './puzzle-save';
import type { StarPuzzle } from './star-puzzle';
import { createUndoHistory } from './undo-history';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the player has marked a cell with: nothing yet, a dot for a cell they know has no star, or a star. */
export type CellMark = 'none' | 'dot' | 'star';

/**
 * One puzzle being solved: the marks the player has made on its cells. The
 * player marks cells with dots and stars, an action at a time, and the
 * puzzle is solved once the stars are its solution's. Dots are the player's
 * own notes, and don't count. Every action can be undone, back to the start
 * of the visit. Once the puzzle is solved, it takes no more marks.
 *
 * It points out stars that break a rule, as they are placed: stars that
 * touch, and the stars of a row, column or region with more than two.
 */
export interface PuzzleModel {
    /** The puzzle being solved. */
    readonly puzzle: StarPuzzle;
    readonly markAt: (cell: number) => CellMark;
    /** Whether `cell` holds a star that breaks a rule. */
    readonly isClashAt: (cell: number) => boolean;
    /** Whether the stars marked are the solution's. */
    readonly isSolved: boolean;
    /** How many actions undo can take back. */
    readonly undoCount: number;
    /** A count that rises with every mark and every undo, so that progress can be kept, and the board redrawn, as it changes. */
    readonly changes: number;
    /** Stars placed, dots marked, marks taken off, stars that broke a rule, and actions undone, since the puzzle opened. */
    readonly starsPlaced: number;
    readonly dotsMarked: number;
    readonly marksCleared: number;
    readonly clashesMade: number;
    readonly undosDone: number;
    /** Dots marked in the stroke being made, or the last one. */
    readonly strokeDots: number;
    /** The cell marked last, or -1. */
    readonly lastMarkedCell: number;

    /** Starts a stroke: the marks until it finishes are undone together. */
    startStroke: () => void;
    /** Marks `cell`, as part of the stroke being made, or as an action of its own if none is. */
    mark: (cell: number, mark: CellMark) => void;
    finishStroke: () => void;
    /** Takes back the last action. */
    undo: () => void;
    /** Returns the puzzle as it stands, to be restored later through the options' `saved`. */
    save: () => PuzzleSave;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PuzzleModelOptions {
    readonly puzzle: StarPuzzle;
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

/** Creates a puzzle with nothing marked, or as it was saved. */
export function createPuzzleModel(options: PuzzleModelOptions): PuzzleModel {
    const { puzzle } = options;
    const { grid, regions, solution } = puzzle;
    const { size, cellCount, neighbours } = grid;
    const marks = readPuzzleSave(options.saved, puzzle) ?? new Uint8Array(cellCount);
    const history = createUndoHistory({ marks, mostUndos: MOST_UNDOS });

    // What the marks mean, worked out as they change, since views ask about them every frame
    const clashes = new Uint8Array(cellCount);
    const rowStars = new Int32Array(size);
    const colStars = new Int32Array(size);
    const regionStars = new Int32Array(size);
    let clashCount = 0;
    let isSolved = false;

    let isStroking = false;
    let changes = 0;
    let starsPlaced = 0;
    let dotsMarked = 0;
    let marksCleared = 0;
    let clashesMade = 0;
    let undosDone = 0;
    let strokeDots = 0;
    let lastMarkedCell = -1;
    findWhatMarksMean();

    const model: PuzzleModel = {
        puzzle,
        markAt: (cell) => MARK_NAMES[marks[cell]],
        isClashAt: (cell) => clashes[cell] === 1,
        get isSolved() { return isSolved; },
        get undoCount() { return history.count; },
        get changes() { return changes; },
        get starsPlaced() { return starsPlaced; },
        get dotsMarked() { return dotsMarked; },
        get marksCleared() { return marksCleared; },
        get clashesMade() { return clashesMade; },
        get undosDone() { return undosDone; },
        get strokeDots() { return strokeDots; },
        get lastMarkedCell() { return lastMarkedCell; },
        startStroke() {
            if (isStroking || isSolved) return;
            isStroking = true;
            strokeDots = 0;
            history.start();
        },
        mark(cell, mark) {
            const state = MARK_STATES[mark];
            if (isSolved || cell < 0 || cell >= cellCount || marks[cell] === state) return;
            const isOwnAction = !isStroking;
            if (isOwnAction) model.startStroke();
            history.keepCell(cell);
            marks[cell] = state;
            lastMarkedCell = cell;
            if (state === STAR_MARK) starsPlaced++;
            else if (state === DOT_MARK) {
                dotsMarked++;
                strokeDots++;
            }
            else marksCleared++;
            const clashesBefore = clashCount;
            findWhatMarksMean();
            if (clashCount > clashesBefore) clashesMade++;
            changes++;
            if (isOwnAction) model.finishStroke();
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
        save: () => writePuzzleSave(puzzle, marks),
    };
    return model;

    /** Works out the clashes, and whether the puzzle is solved, from the marks. */
    function findWhatMarksMean(): void {
        rowStars.fill(0);
        colStars.fill(0);
        regionStars.fill(0);
        for (let cell = 0; cell < cellCount; cell++) {
            if (marks[cell] !== STAR_MARK) continue;
            rowStars[Math.floor(cell / size)]++;
            colStars[cell % size]++;
            regionStars[regions[cell]]++;
        }
        clashCount = 0;
        isSolved = true;
        for (let cell = 0; cell < cellCount; cell++) {
            const isStar = marks[cell] === STAR_MARK;
            if ((solution[cell] === STAR) !== isStar) isSolved = false;
            let isClash = false;
            if (isStar) {
                isClash = rowStars[Math.floor(cell / size)] > STARS_PER_LINE
                    || colStars[cell % size] > STARS_PER_LINE
                    || regionStars[regions[cell]] > STARS_PER_LINE;
                for (let k = 0; k < 8 && !isClash; k++) {
                    const next = neighbours[cell * 8 + k];
                    if (next >= 0 && marks[next] === STAR_MARK) isClash = true;
                }
            }
            clashes[cell] = isClash ? 1 : 0;
            if (isClash) clashCount++;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How a cell's mark is kept: as a digit, so a save writes it out as one. */
const DOT_MARK = 1;
const STAR_MARK = 2;
const MARK_NAMES: readonly CellMark[] = ['none', 'dot', 'star'];
const MARK_STATES: Readonly<Record<CellMark, number>> = { none: 0, dot: DOT_MARK, star: STAR_MARK };
