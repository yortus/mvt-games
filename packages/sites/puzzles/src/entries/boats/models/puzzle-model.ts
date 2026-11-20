import { BOAT } from './cell-states';
import { GIVEN_DINGHY, GIVEN_END_LEFT, GIVEN_END_UP, GIVEN_WATER, isGivenBoat, NO_GIVEN } from './given-pieces';
import { DIAGONALS, findCellAfterRun, findCellBeforeRun } from './harbour-grid';
import { MOST_UNDOS } from './model-constants';
import type { BoatPuzzle } from './boat-puzzle';
import { BOAT_MARK, NO_MARK, type PuzzleSave, readPuzzleSave, WATER_MARK, writePuzzleSave } from './puzzle-save';
import { createUndoHistory } from './undo-history';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The mark on a cell. It is `none` until the player marks it, `water` for a cell they know is open, or `boat` for part of a boat. */
export type CellMark = 'none' | 'water' | 'boat';

/**
 * How a row's or column's number stands. It is `met` when the boat cells
 * marked on the line match the number. It is `broken` when there are too
 * many, or too few unmarked cells left to reach it. Otherwise it is `open`.
 */
export type ClueState = 'open' | 'met' | 'broken';

/**
 * One harbour being solved, with the marks the player has made on its
 * cells. Its givens, the water and boat pieces printed on it, are marks
 * from the start, which never change. The puzzle is solved once the boat
 * marks match the solution. Water marks are the player's own notes, and
 * don't count. The player marks cells a stroke at a time, and undo takes
 * back a whole stroke. The last `MOST_UNDOS` strokes can be undone, as far
 * back as when the puzzle opened. Once the puzzle is solved, it ignores
 * every action.
 *
 * It points out each mark that breaks a rule, as the marks are made. These
 * are the clashes it finds:
 *
 * - boats that touch diagonally
 * - a boat longer than any in the fleet
 * - a boat beside a printed piece that says there is water there
 * - water beside a printed end, on the side its boat goes on
 *
 * It also finds the finished boats, so the fleet can be ticked off. A
 * finished boat is a straight run of boat cells with water or the edge past
 * each end, or on every side of a single cell.
 */
export interface PuzzleModel {
    /** The puzzle being solved. */
    readonly puzzle: BoatPuzzle;
    /** The mark on `cell`, given or the player's. */
    readonly markAt: (cell: number) => CellMark;
    /** Whether `cell` is a given, which is water or a piece of a boat printed on the harbour. The player can't change a given. */
    readonly isGivenAt: (cell: number) => boolean;
    /** Whether `cell` holds a boat that breaks a rule. */
    readonly isClashAt: (cell: number) => boolean;
    /** How the number of `line` stands. The lines are the rows from the top, then the columns from the left. */
    readonly clueStateAt: (line: number) => ClueState;
    /**
     * How many finished boats `length` cells long are marked. Once the
     * puzzle is solved, every boat counts as found, so it returns how many
     * boats of that length the fleet has.
     */
    readonly finishedBoatCountOf: (length: number) => number;
    /** Whether the boat marks match the solution. */
    readonly isSolved: boolean;
    /** How many strokes undo can take back. */
    readonly undoCount: number;
    /** A count that rises with every mark and every undo, so that progress can be kept, and the harbour redrawn, as it changes. */
    readonly changes: number;
    /** Boat cells marked since the puzzle opened. */
    readonly boatsMarked: number;
    /** Water cells marked since the puzzle opened. */
    readonly waterMarked: number;
    /** Marks taken off since the puzzle opened. */
    readonly marksCleared: number;
    /** Marks that made more boats break a rule, since the puzzle opened. */
    readonly clashesMade: number;
    /** Strokes that finished more boats, since the puzzle opened. */
    readonly boatsFinished: number;
    /** Strokes that marked two cells or more, since the puzzle opened. */
    readonly sweepsMade: number;
    /** Strokes undone since the puzzle opened. */
    readonly undosDone: number;
    /** The cell marked last, or -1. */
    readonly lastMarkedCell: number;

    /** Starts a stroke. The marks made until it finishes are undone together. */
    startStroke: () => void;
    /** Marks `cell`, as part of the stroke being made, or as a stroke of its own if none is. Ignores a given, and a cell off the harbour. */
    mark: (cell: number, mark: CellMark) => void;
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
    readonly puzzle: BoatPuzzle;
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

/** Creates a puzzle with only its givens marked, or as it was saved. */
export function createPuzzleModel(options: PuzzleModelOptions): PuzzleModel {
    const { puzzle } = options;
    const { grid, fleet, rowCounts, colCounts, givens, solution } = puzzle;
    const { size, cellCount, neighbours, sides } = grid;
    const longest = fleet[0];
    let marks = readPuzzleSave(options.saved, puzzle) ?? Uint8Array.from(givens, toGivenMark);
    const history = createUndoHistory<Uint8Array>({ mostUndos: MOST_UNDOS });
    // How many boats of each length the fleet has
    const fleetCounts = new Int32Array(longest + 1);
    for (let i = 0; i < fleet.length; i++) fleetCounts[fleet[i]]++;

    // What the marks mean, worked out as they change, since views read them every frame
    const clashes = new Uint8Array(cellCount);
    const clueStates: ClueState[] = new Array<ClueState>(size * 2).fill('open');
    const finishedCounts = new Int32Array(longest + 1);
    const boatOf = new Int32Array(cellCount);
    const run: number[] = [];
    let clashCount = 0;
    let finishedCount = 0;
    let isSolved = false;

    // The stroke being made. It keeps the marks from before it, and how many cells it marked
    let strokeBefore: Uint8Array | undefined;
    let strokeCells = 0;
    let strokeClashes = 0;
    let strokeFinished = 0;

    let changes = 0;
    let boatsMarked = 0;
    let waterMarked = 0;
    let marksCleared = 0;
    let clashesMade = 0;
    let boatsFinished = 0;
    let sweepsMade = 0;
    let undosDone = 0;
    let lastMarkedCell = -1;
    findWhatMarksMean();

    const model: PuzzleModel = {
        puzzle,
        markAt: (cell) => MARK_NAMES[marks[cell]],
        isGivenAt: (cell) => givens[cell] !== NO_GIVEN,
        isClashAt: (cell) => clashes[cell] === 1,
        clueStateAt: (line) => clueStates[line],
        finishedBoatCountOf(length) {
            if (length < 0 || length > longest) return 0;
            return isSolved ? fleetCounts[length] : finishedCounts[length];
        },
        get isSolved() { return isSolved; },
        get undoCount() { return history.count; },
        get changes() { return changes; },
        get boatsMarked() { return boatsMarked; },
        get waterMarked() { return waterMarked; },
        get marksCleared() { return marksCleared; },
        get clashesMade() { return clashesMade; },
        get boatsFinished() { return boatsFinished; },
        get sweepsMade() { return sweepsMade; },
        get undosDone() { return undosDone; },
        get lastMarkedCell() { return lastMarkedCell; },
        startStroke() {
            if (strokeBefore !== undefined || isSolved) return;
            strokeBefore = marks.slice();
            strokeCells = 0;
            strokeClashes = clashCount;
            strokeFinished = finishedCount;
        },
        mark(cell, mark) {
            const stored = MARK_VALUES[mark];
            if (isSolved || cell < 0 || cell >= cellCount || marks[cell] === stored || givens[cell] !== NO_GIVEN) return;
            const isOwnStroke = strokeBefore === undefined;
            if (isOwnStroke) model.startStroke();
            marks[cell] = stored;
            lastMarkedCell = cell;
            strokeCells++;
            if (stored === BOAT_MARK) boatsMarked++;
            else if (stored === WATER_MARK) waterMarked++;
            else marksCleared++;
            const clashesBefore = clashCount;
            findWhatMarksMean();
            if (clashCount > clashesBefore) clashesMade++;
            changes++;
            if (isOwnStroke) model.finishStroke();
        },
        finishStroke() {
            if (strokeBefore === undefined) return;
            if (strokeCells > 0) {
                history.keep(strokeBefore);
                if (strokeCells >= 2) sweepsMade++;
                // A boat finished counts once for its stroke, so a sweep that finishes two plays one sound
                if (finishedCount > strokeFinished && clashCount <= strokeClashes) boatsFinished++;
            }
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

    /** Works out the clashes, the finished boats, the numbers' states, and whether the puzzle is solved, from the marks. */
    function findWhatMarksMean(): void {
        clashes.fill(0);
        finishedCounts.fill(0);
        boatOf.fill(-1);
        isSolved = true;
        for (let cell = 0; cell < cellCount; cell++) {
            const isBoat = marks[cell] === BOAT_MARK;
            if ((solution[cell] === BOAT) !== isBoat) isSolved = false;
            if (!isBoat) continue;
            // Boats that touch diagonally
            for (let i = 0; i < DIAGONALS.length; i++) {
                const next = neighbours[cell * 8 + DIAGONALS[i]];
                if (next >= 0 && marks[next] === BOAT_MARK) clashes[cell] = 1;
            }
        }
        findPieceClashes();
        // Each run of boat cells joined side to side clashes if it is too long or bent, and counts if it is finished
        for (let cell = 0; cell < cellCount; cell++) {
            if (marks[cell] !== BOAT_MARK || boatOf[cell] >= 0) continue;
            gatherRun(cell);
            const isStraight = isRunStraight();
            if (run.length > longest || !isStraight) {
                for (let i = 0; i < run.length; i++) clashes[run[i]] = 1;
            }
            else if (isRunFinished()) finishedCounts[run.length]++;
        }
        clashCount = 0;
        finishedCount = 0;
        for (let cell = 0; cell < cellCount; cell++) clashCount += clashes[cell];
        for (let length = 1; length <= longest; length++) finishedCount += finishedCounts[length];
        for (let line = 0; line < size * 2; line++) clueStates[line] = findClueState(line);
    }

    /**
     * Marks each printed dinghy or end as clashing where a boat is marked on
     * a side that it says is water, and marks that boat too. Water marked on
     * the side that an end's boat goes on clashes as well.
     */
    function findPieceClashes(): void {
        for (let cell = 0; cell < cellCount; cell++) {
            const given = givens[cell];
            if (given !== GIVEN_DINGHY && (given < GIVEN_END_UP || given > GIVEN_END_LEFT)) continue;
            const onward = given === GIVEN_DINGHY ? -1 : given - GIVEN_END_UP;
            for (let side = 0; side < 4; side++) {
                const next = sides[cell * 4 + side];
                if (next < 0) continue;
                const isBroken = side === onward ? marks[next] === WATER_MARK : marks[next] === BOAT_MARK;
                if (!isBroken) continue;
                clashes[cell] = 1;
                if (marks[next] === BOAT_MARK) clashes[next] = 1;
            }
        }
    }

    /** Gathers the boat cells joined to `first`, side to side, into `run`. */
    function gatherRun(first: number): void {
        run.length = 0;
        run.push(first);
        boatOf[first] = first;
        for (let i = 0; i < run.length; i++) {
            for (let side = 0; side < 4; side++) {
                const next = sides[run[i] * 4 + side];
                if (next < 0 || marks[next] !== BOAT_MARK || boatOf[next] >= 0) continue;
                boatOf[next] = first;
                run.push(next);
            }
        }
    }

    /** Whether `run` lies along one row or one column. */
    function isRunStraight(): boolean {
        let isAcross = true;
        let isDown = true;
        for (let i = 1; i < run.length; i++) {
            if (Math.floor(run[i] / size) !== Math.floor(run[0] / size)) isAcross = false;
            if (run[i] % size !== run[0] % size) isDown = false;
        }
        return isAcross || isDown;
    }

    /** Whether the straight `run` has water marked, or the edge, past both its ends, or on every side of a single cell. */
    function isRunFinished(): boolean {
        if (run.length === 1) {
            for (let side = 0; side < 4; side++) {
                const next = sides[run[0] * 4 + side];
                if (next >= 0 && marks[next] !== WATER_MARK) return false;
            }
            return true;
        }
        // A longer boat goes on only past its ends. Its sides are known to be water, since a boat there would touch it
        let first = run[0];
        let last = run[0];
        for (let i = 1; i < run.length; i++) {
            first = Math.min(first, run[i]);
            last = Math.max(last, run[i]);
        }
        const before = findCellBeforeRun(grid, first, last);
        const after = findCellAfterRun(grid, first, last);
        return (before < 0 || marks[before] === WATER_MARK) && (after < 0 || marks[after] === WATER_MARK);
    }

    /**
     * Returns how the number of `line` stands. It is met if the boat cells
     * marked on the line match the number, and broken if there are too many,
     * or too few unmarked cells left to reach it. Otherwise it is open.
     */
    function findClueState(line: number): ClueState {
        const isColumn = line >= size;
        const index = isColumn ? line - size : line;
        const count = isColumn ? colCounts[index] : rowCounts[index];
        let boats = 0;
        let open = 0;
        for (let i = 0; i < size; i++) {
            const mark = marks[isColumn ? i * size + index : index * size + i];
            if (mark === BOAT_MARK) boats++;
            else if (mark === NO_MARK) open++;
        }
        if (boats > count || boats + open < count) return 'broken';
        return boats === count ? 'met' : 'open';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Each mark's name, by the number it is stored as. */
const MARK_NAMES: readonly CellMark[] = ['none', 'water', 'boat'];

/** The number each mark is stored as, by its name. */
const MARK_VALUES: Readonly<Record<CellMark, number>> = { none: NO_MARK, water: WATER_MARK, boat: BOAT_MARK };

/** Returns the mark that a cell starts with, from its given. That is water, part of a boat, or no mark. */
function toGivenMark(given: number): number {
    if (given === GIVEN_WATER) return WATER_MARK;
    return isGivenBoat(given) ? BOAT_MARK : NO_MARK;
}
