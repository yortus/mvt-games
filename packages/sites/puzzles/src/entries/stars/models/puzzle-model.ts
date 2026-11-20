import { EMPTY, STAR, UNKNOWN } from './cell-states';
import { MOST_UNDOS } from './model-constants';
import { CROSS_MARK, NO_MARK, type PuzzleSave, readPuzzleSave, STAR_MARK, writePuzzleSave } from './puzzle-save';
import { STARS_PER_LINE } from './star-grid';
import type { StarPuzzle } from './star-puzzle';
import { createUndoHistory } from './undo-history';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the player has marked a cell with: nothing yet, a cross for a cell they know has no star, or a star. */
export type CellMark = 'none' | 'cross' | 'star';

/** How a group the player ringed stands: still open, met by a star placed in it, or broken, with a cross in every cell. */
export type GroupState = 'open' | 'met' | 'broken';

/**
 * One puzzle being solved: the marks the player has made on its cells, and
 * the groups of cells they have ringed. Groups never overlap, and each is
 * joined side to side, so its ring is one simple shape. Its givens, the
 * stars and crosses printed on it, are marks from the start, which never
 * change. The puzzle is solved once the stars are its solution's. Crosses
 * and groups are the player's own notes, and don't count: a cross says a
 * cell has no star, and a group says a star is in one of its cells. The
 * last `MOST_UNDOS` actions can be undone, as far back as when the puzzle
 * opened. Once the puzzle is solved, it ignores every action.
 *
 * It points out stars that break a rule, as they are placed: stars that
 * touch, and the stars of a row, column or region with too many.
 */
export interface PuzzleModel {
    /** The puzzle being solved. */
    readonly puzzle: StarPuzzle;
    /** The mark on `cell`, given or the player's. */
    readonly markAt: (cell: number) => CellMark;
    /** Whether `cell` is a given: a star or a cross printed on the grid, which the player can't change. */
    readonly isGivenAt: (cell: number) => boolean;
    /** Whether `cell` holds a star that breaks a rule. */
    readonly isClashAt: (cell: number) => boolean;
    /** The groups ringed, each its cells in order. The list is replaced, never changed, as groups come and go. */
    readonly groups: readonly (readonly number[])[];
    /** How the group at `index` in `groups` stands. */
    readonly groupStateAt: (index: number) => GroupState;
    /** Which group has exactly `cells`, in any order, or -1 if none does. */
    readonly findGroup: (cells: readonly number[]) => number;
    /** Whether `cells` can be ringed as a group: two or more, joined side to side, and none of them in a group already. */
    readonly canNoteGroup: (cells: readonly number[]) => boolean;
    /** Whether the stars marked are the solution's. */
    readonly isSolved: boolean;
    /** How many actions undo can take back. */
    readonly undoCount: number;
    /** A count that rises with every mark, every group and every undo, so that progress can be kept, and the board redrawn, as it changes. */
    readonly changes: number;
    /** Stars placed since the puzzle opened. */
    readonly starsPlaced: number;
    /** Crosses marked since the puzzle opened. */
    readonly crossesMarked: number;
    /** Marks taken off since the puzzle opened. */
    readonly marksCleared: number;
    /** Marks that made more stars break a rule, since the puzzle opened. */
    readonly clashesMade: number;
    /** Groups ringed since the puzzle opened. */
    readonly groupsNoted: number;
    /** Rings taken off since the puzzle opened. */
    readonly groupsCleared: number;
    /** Actions undone since the puzzle opened. */
    readonly undosDone: number;
    /** The cell marked last, or the first cell of the group ringed or taken off last, or -1. */
    readonly lastMarkedCell: number;

    /** Marks `cell`. Ignores a given, and a cell off the grid. */
    mark: (cell: number, mark: CellMark) => void;
    /** Rings `cells` as a group, the player's note that a star is in one of them. Ignores `cells` unless `canNoteGroup(cells)` is true. */
    noteGroup: (cells: readonly number[]) => void;
    /** Removes the group at `index` in `groups`. */
    clearGroup: (index: number) => void;
    /** Undoes the last action, if there is one. */
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
    const { grid, regions, givens, solution } = puzzle;
    const { size, cellCount, neighbours } = grid;
    const saved = readPuzzleSave(options.saved, puzzle);
    let marks = saved?.marks ?? Uint8Array.from(givens, (given) => GIVEN_MARKS[given]);
    let groups: readonly (readonly number[])[] = saved?.groups.map(toSortedCells) ?? [];
    const history = createUndoHistory<Snapshot>({ mostUndos: MOST_UNDOS });

    // What the marks mean, worked out as they change, since views ask about them every frame
    const clashes = new Uint8Array(cellCount);
    const rowStars = new Int32Array(size);
    const colStars = new Int32Array(size);
    const regionStars = new Int32Array(size);
    let groupStates: GroupState[] = [];
    let clashCount = 0;
    let isSolved = false;

    let changes = 0;
    let starsPlaced = 0;
    let crossesMarked = 0;
    let marksCleared = 0;
    let clashesMade = 0;
    let groupsNoted = 0;
    let groupsCleared = 0;
    let undosDone = 0;
    let lastMarkedCell = -1;
    findWhatMarksMean();

    const model: PuzzleModel = {
        puzzle,
        markAt: (cell) => MARK_NAMES[marks[cell]],
        isGivenAt: (cell) => givens[cell] !== UNKNOWN,
        isClashAt: (cell) => clashes[cell] === 1,
        get groups() { return groups; },
        groupStateAt: (index) => groupStates[index],
        findGroup(cells) {
            const sorted = toSortedCells(cells);
            return groups.findIndex((group) => group.length === sorted.length && group.every((cell, i) => cell === sorted[i]));
        },
        canNoteGroup: (cells) => isGroupAllowed(toSortedCells(cells)),
        get isSolved() { return isSolved; },
        get undoCount() { return history.count; },
        get changes() { return changes; },
        get starsPlaced() { return starsPlaced; },
        get crossesMarked() { return crossesMarked; },
        get marksCleared() { return marksCleared; },
        get clashesMade() { return clashesMade; },
        get groupsNoted() { return groupsNoted; },
        get groupsCleared() { return groupsCleared; },
        get undosDone() { return undosDone; },
        get lastMarkedCell() { return lastMarkedCell; },
        mark(cell, mark) {
            const state = MARK_STATES[mark];
            if (isSolved || cell < 0 || cell >= cellCount || marks[cell] === state || givens[cell] !== UNKNOWN) return;
            keepForUndo();
            marks[cell] = state;
            lastMarkedCell = cell;
            if (state === STAR_MARK) starsPlaced++;
            else if (state === CROSS_MARK) crossesMarked++;
            else marksCleared++;
            const clashesBefore = clashCount;
            findWhatMarksMean();
            if (clashCount > clashesBefore) clashesMade++;
            changes++;
        },
        noteGroup(cells) {
            const group = toSortedCells(cells);
            if (isSolved || !isGroupAllowed(group)) return;
            keepForUndo();
            groups = [...groups, group];
            lastMarkedCell = group[0];
            groupsNoted++;
            findWhatMarksMean();
            changes++;
        },
        clearGroup(index) {
            if (isSolved || index < 0 || index >= groups.length) return;
            keepForUndo();
            lastMarkedCell = groups[index][0];
            groups = groups.filter((_, i) => i !== index);
            groupsCleared++;
            findWhatMarksMean();
            changes++;
        },
        undo() {
            if (isSolved) return;
            const before = history.takeBack();
            if (before === undefined) return;
            marks = before.marks;
            groups = before.groups;
            findWhatMarksMean();
            undosDone++;
            changes++;
        },
        save: () => writePuzzleSave(puzzle, marks, groups),
    };
    return model;

    /** Whether `group`, its cells in order, is two cells or more, on the grid, joined side to side, and clear of every group. */
    function isGroupAllowed(group: readonly number[]): boolean {
        if (group.length < 2 || group[0] < 0 || group[group.length - 1] >= cellCount) return false;
        for (let i = 0; i < groups.length; i++) {
            if (groups[i].some((cell) => group.includes(cell))) return false;
        }
        // Spread from the first cell across shared sides, and see if every cell is reached
        const reached = [group[0]];
        for (let i = 0; i < reached.length; i++) {
            for (let side = 0; side < 4; side++) {
                const next = grid.sides[reached[i] * 4 + side];
                if (next >= 0 && group.includes(next) && !reached.includes(next)) reached.push(next);
            }
        }
        return reached.length === group.length;
    }

    /** Keeps the marks and groups as they are, before an action changes them. */
    function keepForUndo(): void {
        history.keep({ marks: marks.slice(), groups });
    }

    /** Works out the clashes, the groups' states, and whether the puzzle is solved, from the marks. */
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
        groupStates = groups.map(findGroupState);
    }

    function findGroupState(group: readonly number[]): GroupState {
        if (group.some((cell) => marks[cell] === STAR_MARK)) return 'met';
        return group.every((cell) => marks[cell] === CROSS_MARK) ? 'broken' : 'open';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Each mark's name, by the number it is kept as. */
const MARK_NAMES: Readonly<Record<number, CellMark>> = { [NO_MARK]: 'none', [CROSS_MARK]: 'cross', [STAR_MARK]: 'star' };

/** The number each mark is kept as, by its name. */
const MARK_STATES: Readonly<Record<CellMark, number>> = { none: NO_MARK, cross: CROSS_MARK, star: STAR_MARK };

/** The mark each cell starts with, by its given. A given star starts as a star, a given cross as a cross, and every other cell unmarked. */
const GIVEN_MARKS: Readonly<Record<number, number>> = { [UNKNOWN]: NO_MARK, [STAR]: STAR_MARK, [EMPTY]: CROSS_MARK };

/** The puzzle as it was before an action, for undo to put back. */
interface Snapshot {
    readonly marks: Uint8Array;
    readonly groups: readonly (readonly number[])[];
}

/** Returns `cells` in order, each once. */
function toSortedCells(cells: readonly number[]): number[] {
    return [...new Set(cells)].sort((a, b) => a - b);
}
