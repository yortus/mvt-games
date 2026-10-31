import { describe, expect, it } from 'vitest';
import { CELL_COUNT, loadSudokuGenerator } from '#sudoku-digger';
import { MOST_UNDOS } from './model-constants';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';

// The puzzle is a real one, made the way the game makes them.

const generateSudoku = await loadSudokuGenerator();
const { givens, solution } = generateSudoku({ seed: 1, level: 'easy' });
const EMPTY_CELLS = givens.flatMap((digit, cell) => (digit === 0 ? [cell] : []));
const GIVEN_CELL = givens.findIndex((digit) => digit !== 0);

describe('PuzzleModel', () => {
    it('starts with its givens, and nothing filled in or noted', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            expect(puzzle.digitAt(cell)).toBe(givens[cell]);
            expect(puzzle.isGivenAt(cell)).toBe(givens[cell] !== 0);
            expect(puzzle.marksAt(cell)).toBe(0);
            expect(puzzle.isClashAt(cell)).toBe(false);
        }
        expect(puzzle.groupNotes).toEqual([]);
        expect(puzzle.isSolved).toBe(false);
        expect(puzzle.undoCount).toBe(0);
    });

    it('fills in a digit from the picker, and undoes it', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        const cell = EMPTY_CELLS[0];
        puzzle.openPicker(cell);
        expect(puzzle.pickerCell).toBe(cell);
        // Nothing can be noted while the picker is open
        puzzle.select([cell]);
        puzzle.toggleNote(3);
        expect(puzzle.marksAt(cell)).toBe(0);
        puzzle.fillIn(solution[cell]);
        expect(puzzle.pickerCell).toBe(-1);
        expect(puzzle.digitAt(cell)).toBe(solution[cell]);
        expect(puzzle.answersPlaced).toBe(1);

        puzzle.undo();
        expect(puzzle.digitAt(cell)).toBe(0);
        expect(puzzle.undosDone).toBe(1);
    });

    it('fills in a cell without the picker, but not a given', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        puzzle.fillCell(EMPTY_CELLS[0], solution[EMPTY_CELLS[0]]);
        puzzle.fillCell(GIVEN_CELL, (givens[GIVEN_CELL] % 9) + 1);
        expect(puzzle.digitAt(EMPTY_CELLS[0])).toBe(solution[EMPTY_CELLS[0]]);
        expect(puzzle.digitAt(GIVEN_CELL)).toBe(givens[GIVEN_CELL]);
    });

    it('opens no picker on a given cell', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        puzzle.openPicker(GIVEN_CELL);
        expect(puzzle.pickerCell).toBe(-1);
    });

    it('marks a digit that breaks a rule, and the digit it clashes with', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        // An empty cell, and a given in its row
        const cell = EMPTY_CELLS.find((each) => rowOf(each).some((other) => givens[other] !== 0)) ?? -1;
        const given = rowOf(cell).find((other) => givens[other] !== 0) ?? -1;
        fillIn(puzzle, cell, givens[given]);
        expect(puzzle.isClashAt(cell)).toBe(true);
        expect(puzzle.isClashAt(given)).toBe(true);
        expect(puzzle.clashesMade).toBe(1);

        fillIn(puzzle, cell, 0);
        expect(puzzle.isClashAt(cell)).toBe(false);
        expect(puzzle.isClashAt(given)).toBe(false);
    });

    it('is solved once every cell holds its solution\'s digit, and takes no more actions', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        for (const cell of EMPTY_CELLS) {
            expect(puzzle.isSolved).toBe(false);
            fillIn(puzzle, cell, solution[cell]);
        }
        expect(puzzle.isSolved).toBe(true);

        const undoCount = puzzle.undoCount;
        puzzle.undo();
        fillIn(puzzle, EMPTY_CELLS[0], 0);
        expect(puzzle.isSolved).toBe(true);
        expect(puzzle.undoCount).toBe(undoCount);
    });

    it('undoes no further back than the most it keeps', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        puzzle.select([EMPTY_CELLS[0]]);
        for (let i = 0; i < MOST_UNDOS + 5; i++) puzzle.toggleNote(1);
        expect(puzzle.undoCount).toBe(MOST_UNDOS);
        for (let i = 0; i < MOST_UNDOS + 5; i++) puzzle.undo();
        // Five toggles were too old to undo, which leave the mark in
        expect(puzzle.marksAt(EMPTY_CELLS[0])).toBe(toSet(1));
    });

    it('restores its answers from a save, though undo goes back only to the visit\'s start', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        fillIn(puzzle, EMPTY_CELLS[0], solution[EMPTY_CELLS[0]]);
        const saved = JSON.parse(JSON.stringify(puzzle.save())) as unknown;
        const restored = createPuzzleModel({ givens, solution, saved });
        expect(restored.digitAt(EMPTY_CELLS[0])).toBe(solution[EMPTY_CELLS[0]]);
        expect(restored.undoCount).toBe(0);
    });

    it('restores a save with fields it doesn\'t know, leaving them out', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        fillIn(puzzle, EMPTY_CELLS[0], solution[EMPTY_CELLS[0]]);
        const saved = { ...puzzle.save(), doodles: Array.from({ length: CELL_COUNT }, () => [[100, 200, 300, 400]]) };
        expect(createPuzzleModel({ givens, solution, saved }).digitAt(EMPTY_CELLS[0])).toBe(solution[EMPTY_CELLS[0]]);
    });

    it('ignores a save of other givens, and one that is not a save', () => {
        const puzzle = createPuzzleModel({ givens, solution });
        fillIn(puzzle, EMPTY_CELLS[0], solution[EMPTY_CELLS[0]]);
        const saved = puzzle.save();
        const other = generateSudoku({ seed: 2, level: 'easy' });
        const saves: unknown[] = [
            createPuzzleModel({ givens: other.givens, solution: other.solution }).save(),
            { ...saved, answers: saved.answers.slice(1) },
            { ...saved, marks: [] },
            'not a save',
            undefined,
        ];
        for (const each of saves) {
            expect(createPuzzleModel({ givens, solution, saved: each }).digitAt(EMPTY_CELLS[0])).toBe(0);
        }
    });

    describe('notes', () => {
        // Two empty cells side by side in a row, and an empty cell in another row and box
        const pair = EMPTY_CELLS.find((cell) => cell % 9 < 8 && givens[cell + 1] === 0) ?? -1;
        const firstOfThree = EMPTY_CELLS.find((cell) => cell % 9 < 7 && givens[cell + 1] === 0 && givens[cell + 2] === 0) ?? -1;
        const triple = [firstOfThree, firstOfThree + 1, firstOfThree + 2];
        const elsewhere = EMPTY_CELLS.find((cell) => Math.floor(cell / 27) !== Math.floor(pair / 27) && cell % 9 !== pair % 9) ?? -1;

        it('selects only empty cells, in order', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            puzzle.select([pair + 1, GIVEN_CELL, pair, pair]);
            expect(puzzle.selection).toEqual([pair, pair + 1]);
            expect(puzzle.isSelectedAt(pair)).toBe(true);
            expect(puzzle.isSelectedAt(GIVEN_CELL)).toBe(false);
        });

        it('pencils marks into one cell, and takes them out again, each an action to undo', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            puzzle.select([pair]);
            puzzle.toggleNote(2);
            puzzle.toggleNote(8);
            expect(puzzle.marksAt(pair)).toBe(toSet(2, 8));
            expect(puzzle.selectionDigits).toBe(toSet(2, 8));
            puzzle.toggleNote(2);
            expect(puzzle.marksAt(pair)).toBe(toSet(8));
            puzzle.undo();
            puzzle.undo();
            expect(puzzle.marksAt(pair)).toBe(toSet(2));
            expect(puzzle.undoCount).toBe(1);
        });

        it('notes digits that several cells hold between them, as one group note', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            puzzle.select([pair, pair + 1]);
            puzzle.toggleNote(2);
            puzzle.toggleNote(8);
            expect(puzzle.groupNotes).toHaveLength(1);
            expect(puzzle.groupNotes[0].cells).toEqual([pair, pair + 1]);
            expect(puzzle.groupNotes[0].digits).toBe(toSet(2, 8));
            expect(puzzle.selectionDigits).toBe(toSet(2, 8));
            // The cells' own marks are untouched
            expect(puzzle.marksAt(pair)).toBe(0);

            // Another selection has its own note, and the pair's comes back as it is selected again
            puzzle.select([pair]);
            expect(puzzle.selectionDigits).toBe(0);
            puzzle.select([pair + 1, pair]);
            expect(puzzle.selectionDigits).toBe(toSet(2, 8));

            // A note with no digits left is gone, and undo brings it back
            puzzle.toggleNote(2);
            puzzle.toggleNote(8);
            expect(puzzle.groupNotes).toEqual([]);
            puzzle.undo();
            expect(puzzle.groupNotes[0].digits).toBe(toSet(8));
        });

        it('makes no group note for cells that share no row, column or box', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            puzzle.select([pair, elsewhere]);
            expect(puzzle.canNoteSelection).toBe(false);
            puzzle.toggleNote(4);
            expect(puzzle.groupNotes).toEqual([]);
            expect(puzzle.undoCount).toBe(0);
        });

        it('clears a cell\'s marks as it is filled in, and drops it from the selection', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            puzzle.select([pair]);
            puzzle.toggleNote(5);
            fillIn(puzzle, pair, solution[pair]);
            expect(puzzle.marksAt(pair)).toBe(0);
            expect(puzzle.selection).toEqual([]);
            puzzle.undo();
            expect(puzzle.marksAt(pair)).toBe(toSet(5));
        });

        it('leaves a cell filled in with a digit a group note does not hold out of the note, and keeps the note\'s digits', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            const others = otherDigits(solution[triple[0]], 2);
            note(puzzle, triple, others);
            fillIn(puzzle, triple[0], solution[triple[0]]);
            expect(puzzle.groupNotes.map(({ cells, digits }) => ({ cells, digits }))).toEqual([{ cells: triple.slice(1), digits: toSet(...others) }]);
        });

        it('turns a pair note into pencil marks in the other cell, as a digit it does not hold is filled in', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            const others = otherDigits(solution[pair], 2);
            note(puzzle, [pair, pair + 1], others);
            fillIn(puzzle, pair, solution[pair]);
            expect(puzzle.groupNotes).toEqual([]);
            expect(puzzle.marksAt(pair + 1)).toBe(toSet(...others));
        });

        it('ignores a save with a group note that holds a filled cell, which no save of its own makes', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            note(puzzle, triple, otherDigits(solution[triple[0]], 2));
            const saved = puzzle.save();
            const answers = saved.answers.split('');
            answers[triple[0]] = String(solution[triple[0]]);
            const restored = createPuzzleModel({ givens, solution, saved: { ...saved, answers: answers.join('') } });
            expect(restored.groupNotes).toEqual([]);
            expect(restored.digitAt(triple[0])).toBe(0);
        });

        it('takes the digit filled in, and its cell, out of a group note, which shrinks to the cells left', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            const [p, q] = otherDigits(solution[triple[0]], 2);
            note(puzzle, triple, [solution[triple[0]], p, q]);
            fillIn(puzzle, triple[0], solution[triple[0]]);
            expect(puzzle.groupNotes.map(({ cells, digits }) => ({ cells, digits }))).toEqual([{ cells: triple.slice(1), digits: toSet(p, q) }]);
            puzzle.undo();
            expect(puzzle.groupNotes[0].cells).toEqual(triple);
            expect(puzzle.groupNotes[0].digits).toBe(toSet(solution[triple[0]], p, q));
        });

        it('turns a pair note into a pencil mark in the other cell, as one of its digits is filled in', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            const [other] = otherDigits(solution[pair], 1);
            note(puzzle, [pair, pair + 1], [solution[pair], other]);
            fillIn(puzzle, pair, solution[pair]);
            expect(puzzle.groupNotes).toEqual([]);
            expect(puzzle.marksAt(pair + 1)).toBe(toSet(other));
            puzzle.undo();
            expect(puzzle.groupNotes).toHaveLength(1);
            expect(puzzle.marksAt(pair + 1)).toBe(0);
        });

        it('takes away a group note left with no digits as its one digit is filled in', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            note(puzzle, [pair, pair + 1], [solution[pair]]);
            fillIn(puzzle, pair, solution[pair]);
            expect(puzzle.groupNotes).toEqual([]);
            expect(puzzle.marksAt(pair + 1)).toBe(0);
        });

        it('keeps marks and group notes in a save', () => {
            const puzzle = createPuzzleModel({ givens, solution });
            puzzle.select([pair]);
            puzzle.toggleNote(6);
            puzzle.select([pair, pair + 1]);
            puzzle.toggleNote(1);
            puzzle.toggleNote(9);
            const saved = JSON.parse(JSON.stringify(puzzle.save())) as unknown;
            const restored = createPuzzleModel({ givens, solution, saved });
            expect(restored.marksAt(pair)).toBe(toSet(6));
            expect(restored.groupNotes.map(({ cells, digits }) => ({ cells, digits }))).toEqual([{ cells: [pair, pair + 1], digits: toSet(1, 9) }]);
        });
    });
});

function rowOf(cell: number): number[] {
    const start = Math.floor(cell / 9) * 9;
    return Array.from({ length: 9 }, (_, i) => start + i).filter((other) => other !== cell);
}

function fillIn(puzzle: PuzzleModel, cell: number, digit: number): void {
    puzzle.openPicker(cell);
    puzzle.fillIn(digit);
}

/** The set of `digits`, with bit `d` set for each digit `d`. */
function toSet(...digits: number[]): number {
    let set = 0;
    for (const digit of digits) set |= 1 << digit;
    return set;
}

/** Notes `digits` for `cells` as a group note, and selects nothing after. */
function note(puzzle: PuzzleModel, cells: readonly number[], digits: readonly number[]): void {
    puzzle.select(cells);
    for (const digit of digits) puzzle.toggleNote(digit);
    puzzle.select([]);
}

/** The first `count` digits other than `digit`. */
function otherDigits(digit: number, count: number): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((each) => each !== digit).slice(0, count);
}
