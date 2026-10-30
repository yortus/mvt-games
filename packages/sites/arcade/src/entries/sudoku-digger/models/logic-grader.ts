import {
    BOX_OF, CELL_COUNT, COLUMN_OF, countDigits, findCandidates, lowestDigit, PEER_COUNT, PEERS, ROW_OF, toDigitSet,
    UNIT_CELLS, UNIT_COUNT,
} from './sudoku-rules';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A way a person finds a digit, or rules digits out, without guessing,
 * from the simplest to the hardest the grader knows:
 *
 * - **naked-single**: only one digit could go in a cell.
 * - **hidden-single**: a digit could go in only one cell of a row, a column
 *   or a box.
 * - **locked-candidates**: in one box, a digit could go only along one row
 *   or column, so it can't go elsewhere along that line. Or the same, from
 *   a line into a box.
 * - **naked-pair**: two cells of a unit could hold only the same two
 *   digits, so no other cell of the unit holds either.
 * - **hidden-pair**: two digits could go only in the same two cells of a
 *   unit, so those cells hold nothing else.
 * - **naked-triple**: three cells of a unit could hold only three digits
 *   between them, so no other cell of the unit holds any of them.
 */
export type Technique = 'naked-single' | 'hidden-single' | 'locked-candidates' | 'naked-pair' | 'hidden-pair' | 'naked-triple';

/** Every technique, from the simplest to the hardest. */
export const TECHNIQUES: readonly Technique[] = [
    'naked-single', 'hidden-single', 'locked-candidates', 'naked-pair', 'hidden-pair', 'naked-triple',
];

/** Whether the grader can take another step, has solved the puzzle, or can't go on without guessing. */
export type GraderStatus = 'solving' | 'solved' | 'stuck';

/**
 * Solves a puzzle the way a person would, one step of reasoning at a time,
 * always with the simplest technique that makes progress. It keeps the
 * pencil marks, the digits that could still go in each empty cell. The
 * hardest technique it needs says how hard the puzzle is. If none of its
 * techniques makes progress, the puzzle needs guesswork.
 */
export interface LogicGrader {
    /** The grid: the givens, and the digits the grader has placed. */
    readonly digits: Readonly<Uint8Array>;
    /** The pencil marks: for each empty cell, the set of digits that could still go there. 0 for a filled cell. */
    readonly candidates: Readonly<Uint16Array>;
    /** For each cell, the pencil marks the last step rubbed out. */
    readonly eliminated: Readonly<Uint16Array>;
    readonly status: GraderStatus;
    /** The technique of the last step, or undefined before the first. */
    readonly lastTechnique: Technique | undefined;
    /** The unit the last step reasoned about, or -1. See `UNIT_CELLS` for how units are numbered. */
    readonly lastUnit: number;
    /** The cell the last step filled, or -1 if it only rubbed out pencil marks. */
    readonly lastCell: number;
    /** The digit the last step placed, or the digit it was about. */
    readonly lastDigit: number;
    /** The hardest technique used so far, or undefined before the first step. */
    readonly hardest: Technique | undefined;
    /** Digits placed since the grader started. */
    readonly placements: number;
    /** Steps that rubbed out pencil marks without placing a digit. */
    readonly reductions: number;
    /** Whether `cell` is one the last step's reasoning rests on. */
    isHighlightedAt: (cell: number) => boolean;
    /** Starts grading `givens`, with every pencil mark filled in. */
    start: (givens: Readonly<Uint8Array>) => void;
    /** Takes the next step of reasoning, if there is one. */
    step: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a grader with no puzzle yet. Call `start` to give it one. */
export function createLogicGrader(): LogicGrader {
    const digits = new Uint8Array(CELL_COUNT);
    const candidates = new Uint16Array(CELL_COUNT);
    const eliminated = new Uint16Array(CELL_COUNT);
    const highlighted = new Uint8Array(CELL_COUNT);
    let filledCount = CELL_COUNT;
    let status: GraderStatus = 'solved';
    let lastTechnique: Technique | undefined;
    let lastUnit = -1;
    let lastCell = -1;
    let lastDigit = 0;
    let hardest: Technique | undefined;
    let placements = 0;
    let reductions = 0;

    const grader: LogicGrader = {
        digits,
        candidates,
        eliminated,
        get status() { return status; },
        get lastTechnique() { return lastTechnique; },
        get lastUnit() { return lastUnit; },
        get lastCell() { return lastCell; },
        get lastDigit() { return lastDigit; },
        get hardest() { return hardest; },
        get placements() { return placements; },
        get reductions() { return reductions; },
        isHighlightedAt: (cell) => highlighted[cell] === 1,
        start,
        step,
    };
    return grader;

    function start(givens: Readonly<Uint8Array>): void {
        digits.set(givens);
        filledCount = 0;
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            if (digits[cell] !== 0) filledCount++;
        }
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            candidates[cell] = digits[cell] === 0 ? findCandidates(digits, cell) : 0;
        }
        eliminated.fill(0);
        highlighted.fill(0);
        status = filledCount === CELL_COUNT ? 'solved' : 'solving';
        lastTechnique = undefined;
        lastUnit = -1;
        lastCell = -1;
        lastDigit = 0;
        hardest = undefined;
        placements = 0;
        reductions = 0;
    }

    function step(): void {
        if (status !== 'solving') return;
        eliminated.fill(0);
        highlighted.fill(0);
        lastUnit = -1;
        lastCell = -1;
        const isDone = findNakedSingle() || findHiddenSingle() || findLockedCandidates()
            || findNakedPair() || findHiddenPair() || findNakedTriple();
        if (!isDone) {
            status = 'stuck';
            lastTechnique = undefined;
            return;
        }
        if (lastCell >= 0) placements++;
        else reductions++;
        if (filledCount === CELL_COUNT) status = 'solved';
    }

    // --- The techniques, each returning whether it made progress ---

    function findNakedSingle(): boolean {
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            if (digits[cell] === 0 && countDigits(candidates[cell]) === 1) {
                highlighted[cell] = 1;
                place(cell, lowestDigit(candidates[cell]), 'naked-single', -1);
                return true;
            }
        }
        return false;
    }

    function findHiddenSingle(): boolean {
        // Boxes first, then rows, then columns, the order people tend to look in
        for (let i = 0; i < UNIT_COUNT; i++) {
            const unit = (i + 18) % UNIT_COUNT;
            for (let digit = 1; digit <= 9; digit++) {
                const cell = findOnlyCellFor(unit, digit);
                if (cell >= 0) {
                    highlightUnit(unit);
                    place(cell, digit, 'hidden-single', unit);
                    return true;
                }
            }
        }
        return false;
    }

    function findLockedCandidates(): boolean {
        for (let unit = 0; unit < UNIT_COUNT; unit++) {
            for (let digit = 1; digit <= 9; digit++) {
                const bit = toDigitSet(digit);
                // The row, column or box every cell of this unit that could hold the digit shares, past this unit
                let sharedRow = -2;
                let sharedColumn = -2;
                let sharedBox = -2;
                for (let i = unit * 9; i < unit * 9 + 9; i++) {
                    const cell = UNIT_CELLS[i];
                    if ((candidates[cell] & bit) === 0) continue;
                    sharedRow = sharedRow === -2 || sharedRow === ROW_OF[cell] ? ROW_OF[cell] : -1;
                    sharedColumn = sharedColumn === -2 || sharedColumn === COLUMN_OF[cell] ? COLUMN_OF[cell] : -1;
                    sharedBox = sharedBox === -2 || sharedBox === BOX_OF[cell] ? BOX_OF[cell] : -1;
                }
                if (sharedRow === -2) continue;
                // From a box, the line its cells share. From a line, the box they share
                const other = unit >= 18
                    ? (sharedRow >= 0 ? sharedRow : sharedColumn >= 0 ? 9 + sharedColumn : -1)
                    : (sharedBox >= 0 ? 18 + sharedBox : -1);
                if (other < 0) continue;
                if (eliminateOutside(other, unit, bit)) {
                    highlightCandidates(unit, bit);
                    record('locked-candidates', unit, digit);
                    return true;
                }
            }
        }
        return false;
    }

    function findNakedPair(): boolean {
        for (let unit = 0; unit < UNIT_COUNT; unit++) {
            for (let i = 0; i < 9; i++) {
                const a = UNIT_CELLS[unit * 9 + i];
                if (countDigits(candidates[a]) !== 2) continue;
                for (let j = i + 1; j < 9; j++) {
                    const b = UNIT_CELLS[unit * 9 + j];
                    if (candidates[b] !== candidates[a]) continue;
                    const set = candidates[a];
                    if (eliminateFromUnit(unit, set, a, b, -1)) {
                        highlighted[a] = 1;
                        highlighted[b] = 1;
                        record('naked-pair', unit, lowestDigit(set));
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function findHiddenPair(): boolean {
        for (let unit = 0; unit < UNIT_COUNT; unit++) {
            for (let first = 1; first <= 9; first++) {
                const firstPlaces = findPlaces(unit, first);
                if (countDigits(firstPlaces) !== 2) continue;
                for (let second = first + 1; second <= 9; second++) {
                    if (findPlaces(unit, second) !== firstPlaces) continue;
                    const keep = toDigitSet(first) | toDigitSet(second);
                    const a = UNIT_CELLS[unit * 9 + lowestDigit(firstPlaces)];
                    const b = UNIT_CELLS[unit * 9 + 31 - Math.clz32(firstPlaces)];
                    const removed = (candidates[a] & ~keep) | (candidates[b] & ~keep);
                    if (removed === 0) continue;
                    rubOut(a, candidates[a] & ~keep);
                    rubOut(b, candidates[b] & ~keep);
                    highlighted[a] = 1;
                    highlighted[b] = 1;
                    record('hidden-pair', unit, first);
                    return true;
                }
            }
        }
        return false;
    }

    function findNakedTriple(): boolean {
        for (let unit = 0; unit < UNIT_COUNT; unit++) {
            for (let i = 0; i < 9; i++) {
                const a = UNIT_CELLS[unit * 9 + i];
                if (!isTripleMember(a)) continue;
                for (let j = i + 1; j < 9; j++) {
                    const b = UNIT_CELLS[unit * 9 + j];
                    if (!isTripleMember(b) || countDigits(candidates[a] | candidates[b]) > 3) continue;
                    for (let k = j + 1; k < 9; k++) {
                        const c = UNIT_CELLS[unit * 9 + k];
                        const set = candidates[a] | candidates[b] | candidates[c];
                        if (!isTripleMember(c) || countDigits(set) !== 3) continue;
                        if (eliminateFromUnit(unit, set, a, b, c)) {
                            highlighted[a] = 1;
                            highlighted[b] = 1;
                            highlighted[c] = 1;
                            record('naked-triple', unit, lowestDigit(set));
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    // --- Changing the grid and the pencil marks ---

    /** Writes `digit` into `cell`, and rubs it out of the pencil marks of the cell's peers. */
    function place(cell: number, digit: number, technique: Technique, unit: number): void {
        const bit = toDigitSet(digit);
        digits[cell] = digit;
        candidates[cell] = 0;
        filledCount++;
        for (let i = cell * PEER_COUNT; i < cell * PEER_COUNT + PEER_COUNT; i++) rubOut(PEERS[i], candidates[PEERS[i]] & bit);
        lastCell = cell;
        record(technique, unit, digit);
    }

    /** Notes the technique a step used, and what it was about. */
    function record(technique: Technique, unit: number, digit: number): void {
        lastTechnique = technique;
        lastUnit = unit;
        lastDigit = digit;
        if (hardest === undefined || TECHNIQUES.indexOf(technique) > TECHNIQUES.indexOf(hardest)) hardest = technique;
    }

    function rubOut(cell: number, set: number): void {
        candidates[cell] &= ~set;
        eliminated[cell] |= set;
    }

    /** Rubs `bit` out of the cells of `unit` that are not also in `keep`. Returns whether any went. */
    function eliminateOutside(unit: number, keep: number, bit: number): boolean {
        let isAny = false;
        for (let i = unit * 9; i < unit * 9 + 9; i++) {
            const cell = UNIT_CELLS[i];
            if ((candidates[cell] & bit) === 0 || isInUnit(cell, keep)) continue;
            rubOut(cell, bit);
            isAny = true;
        }
        return isAny;
    }

    /** Rubs `set` out of every cell of `unit` but `a`, `b` and `c`. Returns whether any went. */
    function eliminateFromUnit(unit: number, set: number, a: number, b: number, c: number): boolean {
        let isAny = false;
        for (let i = unit * 9; i < unit * 9 + 9; i++) {
            const cell = UNIT_CELLS[i];
            if (cell === a || cell === b || cell === c || (candidates[cell] & set) === 0) continue;
            rubOut(cell, candidates[cell] & set);
            isAny = true;
        }
        return isAny;
    }

    // --- Looking ---

    /** The one cell of `unit` that could hold `digit`, or -1 if there are none or several. */
    function findOnlyCellFor(unit: number, digit: number): number {
        const places = findPlaces(unit, digit);
        return countDigits(places) === 1 ? UNIT_CELLS[unit * 9 + lowestDigit(places)] : -1;
    }

    /** The places along `unit`, from 0 to 8, that could hold `digit`, as a set of bits. */
    function findPlaces(unit: number, digit: number): number {
        const bit = toDigitSet(digit);
        let places = 0;
        for (let i = 0; i < 9; i++) {
            if ((candidates[UNIT_CELLS[unit * 9 + i]] & bit) !== 0) places |= 1 << i;
        }
        return places;
    }

    function isTripleMember(cell: number): boolean {
        const count = countDigits(candidates[cell]);
        return count === 2 || count === 3;
    }

    function highlightUnit(unit: number): void {
        for (let i = unit * 9; i < unit * 9 + 9; i++) highlighted[UNIT_CELLS[i]] = 1;
    }

    function highlightCandidates(unit: number, bit: number): void {
        for (let i = unit * 9; i < unit * 9 + 9; i++) {
            if ((candidates[UNIT_CELLS[i]] & bit) !== 0) highlighted[UNIT_CELLS[i]] = 1;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function isInUnit(cell: number, unit: number): boolean {
    if (unit < 9) return ROW_OF[cell] === unit;
    if (unit < 18) return COLUMN_OF[cell] === unit - 9;
    return BOX_OF[cell] === unit - 18;
}
