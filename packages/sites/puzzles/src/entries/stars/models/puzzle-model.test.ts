import { describe, expect, it } from 'vitest';
import { STAR } from './cell-states';
import { LEVEL_SETTINGS } from './levels';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';
import { createStarPuzzle } from './star-puzzle';

// One puzzle for every test: making one takes a moment
const PUZZLE = createStarPuzzle({ seed: 1, settings: LEVEL_SETTINGS.easy! });
const { size } = PUZZLE.grid;
const STARS: number[] = [];
for (let cell = 0; cell < PUZZLE.grid.cellCount; cell++) {
    if (PUZZLE.solution[cell] === STAR) STARS.push(cell);
}

describe('createPuzzleModel', () => {
    it('is solved once its stars are the solution\'s, whatever dots there are, and then takes no more marks', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        const empty = findEmptyCell();
        model.mark(empty, 'dot');
        for (let i = 0; i < STARS.length - 1; i++) model.mark(STARS[i], 'star');
        expect(model.isSolved).toBe(false);
        model.mark(STARS[STARS.length - 1], 'star');
        expect(model.isSolved).toBe(true);
        model.mark(empty, 'star');
        expect(model.markAt(empty)).toBe('dot');
    });

    it('points out stars that touch, and only those', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        const star = STARS[0];
        const touching = PUZZLE.grid.neighbours.slice(star * 8, star * 8 + 8).find((cell) => cell >= 0)!;
        model.mark(star, 'star');
        expect(model.isClashAt(star)).toBe(false);
        model.mark(touching, 'star');
        expect([model.isClashAt(star), model.isClashAt(touching), model.clashesMade]).toEqual([true, true, 1]);
    });

    it('points out every star of a row with more than two', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        // Three cells two apart along the top row touch nothing, so the row alone is broken
        const row = [0, 2, 4];
        for (let i = 0; i < row.length; i++) model.mark(row[i], 'star');
        expect(row.map((cell) => model.isClashAt(cell))).toEqual([true, true, true]);
        expect(size).toBeGreaterThan(4);
    });

    it('undoes a stroke as one action, back to how the cells were before it', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        const [a, b] = PUZZLE.grid.neighbours.slice(STARS[0] * 8, STARS[0] * 8 + 8).filter((cell) => cell >= 0);
        model.mark(STARS[0], 'star');
        model.startStroke();
        model.mark(a, 'dot');
        model.mark(b, 'dot');
        model.finishStroke();
        expect([model.strokeDots, model.undoCount]).toEqual([2, 2]);
        model.undo();
        expect([model.markAt(a), model.markAt(b), model.markAt(STARS[0])]).toEqual(['none', 'none', 'star']);
    });

    it('comes back as it was saved, and starts afresh from a save of another puzzle', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        model.mark(STARS[0], 'star');
        model.mark(findEmptyCell(), 'dot');
        const restored = createPuzzleModel({ puzzle: PUZZLE, saved: model.save() });
        expect(readMarks(restored)).toEqual(readMarks(model));
        const other = createStarPuzzle({ seed: 2, settings: LEVEL_SETTINGS.easy! });
        expect(readMarks(createPuzzleModel({ puzzle: other, saved: model.save() })).every((mark) => mark === 'none')).toBe(true);
    });
});

/** A cell the solution has no star in. */
function findEmptyCell(): number {
    return PUZZLE.solution.findIndex((state) => state !== STAR);
}

function readMarks(model: PuzzleModel): string[] {
    return Array.from({ length: model.puzzle.grid.cellCount }, (_, cell) => model.markAt(cell));
}
