import { describe, expect, it } from 'vitest';
import { BOAT, WATER } from './cell-states';
import { GIVEN_DINGHY, NO_GIVEN } from './given-pieces';
import { LEVEL_SETTINGS } from './levels';
import { createBoatPuzzle } from './boat-puzzle';
import { createPuzzleModel } from './puzzle-model';
import { NO_MARK } from './puzzle-save';

// Every test uses one Medium puzzle with its givens taken away, so that any
// cell can be marked. A test that needs a given prints its own.
const MADE = createBoatPuzzle({ seed: 1, settings: LEVEL_SETTINGS.medium });
const PUZZLE = { ...MADE, givens: new Uint8Array(MADE.grid.cellCount).fill(NO_GIVEN) };
const { size } = PUZZLE.grid;
const BOATS: number[] = [];
for (let cell = 0; cell < PUZZLE.grid.cellCount; cell++) {
    if (PUZZLE.solution[cell] === BOAT) BOATS.push(cell);
}

describe('createPuzzleModel', () => {
    it('is solved once the boat marks match the solution, whatever water is marked, and then ignores marks', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        const water = PUZZLE.solution.indexOf(WATER);
        model.mark(water, 'water');
        for (let i = 0; i < BOATS.length - 1; i++) model.mark(BOATS[i], 'boat');
        expect(model.isSolved).toBe(false);
        model.mark(BOATS[BOATS.length - 1], 'boat');
        expect(model.isSolved).toBe(true);
        model.mark(water, 'none');
        expect(model.markAt(water)).toBe('water');
    });

    it('points out boats that touch diagonally, and a boat longer than any in the fleet', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        model.mark(0, 'boat');
        model.mark(size + 1, 'boat');
        expect([model.isClashAt(0), model.isClashAt(size + 1), model.clashesMade]).toEqual([true, true, 1]);
        model.undo();
        // A row of boat cells one longer than the fleet's longest, which comes first
        const row = 3 * size;
        const length = PUZZLE.fleet[0] + 1;
        for (let col = 0; col < length; col++) model.mark(row + col, 'boat');
        expect(model.isClashAt(row)).toBe(true);
    });

    it('counts a boat finished once water is marked past both its ends, and ticks it off by its length', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        const row = 2 * size;
        model.mark(row + 1, 'boat');
        model.mark(row + 2, 'boat');
        model.mark(row, 'water');
        expect(model.finishedBoatCountOf(2)).toBe(0);
        model.mark(row + 3, 'water');
        expect([model.finishedBoatCountOf(2), model.boatsFinished]).toEqual([1, 1]);
    });

    it('undoes a stroke of several cells as one, and counts it as a sweep', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        model.startStroke();
        for (let col = 0; col < 4; col++) model.mark(col, 'water');
        model.finishStroke();
        expect([model.sweepsMade, model.undoCount]).toEqual([1, 1]);
        model.undo();
        expect([model.markAt(0), model.markAt(3), model.undoCount]).toEqual(['none', 'none', 0]);
    });

    it('points out a boat marked beside a printed dinghy, which has water all round it', () => {
        const givens = new Uint8Array(PUZZLE.grid.cellCount).fill(NO_GIVEN);
        const dinghy = 3 * size + 3;
        givens[dinghy] = GIVEN_DINGHY;
        const model = createPuzzleModel({ puzzle: { ...PUZZLE, givens } });
        model.mark(dinghy + 1, 'boat');
        expect([model.isClashAt(dinghy), model.isClashAt(dinghy + 1)]).toEqual([true, true]);
    });

    it('restores its marks from a save of the same puzzle, and ignores a save of another', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        model.mark(5, 'boat');
        model.mark(6, 'water');
        const restored = createPuzzleModel({ puzzle: PUZZLE, saved: model.save() });
        expect([restored.markAt(5), restored.markAt(6)]).toEqual(['boat', 'water']);
        const made = createBoatPuzzle({ seed: 2, settings: LEVEL_SETTINGS.medium });
        const other = { ...made, givens: new Uint8Array(made.grid.cellCount).fill(NO_GIVEN) };
        expect(createPuzzleModel({ puzzle: other, saved: model.save() }).markAt(5)).toBe('none');
        expect(createPuzzleModel({ puzzle: PUZZLE, saved: { puzzle: 'nonsense', marks: '9' } }).markAt(5)).toBe('none');
    });

    it('ignores a save of the same puzzle whose marks contradict a given', () => {
        const givens = new Uint8Array(PUZZLE.grid.cellCount).fill(NO_GIVEN);
        const dinghy = 3 * size + 3;
        givens[dinghy] = GIVEN_DINGHY;
        const puzzle = { ...PUZZLE, givens };
        const model = createPuzzleModel({ puzzle });
        model.mark(5, 'boat');
        const saved = model.save();
        // The printed dinghy, saved as unmarked
        const marks = saved.marks.slice(0, dinghy) + String(NO_MARK) + saved.marks.slice(dinghy + 1);
        const restored = createPuzzleModel({ puzzle, saved: { ...saved, marks } });
        expect([restored.markAt(5), restored.markAt(dinghy)]).toEqual(['none', 'boat']);
    });
});
