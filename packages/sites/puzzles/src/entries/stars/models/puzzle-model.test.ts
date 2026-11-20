import { describe, expect, it } from 'vitest';
import { STAR, UNKNOWN } from './cell-states';
import { LEVEL_SETTINGS } from './levels';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';
import { createStarPuzzle } from './star-puzzle';

// One puzzle for every test, making one takes a moment. Most tests take its givens away, so any cell can be marked
const MADE = createStarPuzzle({ seed: 1, settings: LEVEL_SETTINGS.hard });
const PUZZLE = { ...MADE, givens: new Uint8Array(MADE.grid.cellCount).fill(UNKNOWN) };
const { size } = PUZZLE.grid;
const STARS: number[] = [];
for (let cell = 0; cell < PUZZLE.grid.cellCount; cell++) {
    if (PUZZLE.solution[cell] === STAR) STARS.push(cell);
}

describe('createPuzzleModel', () => {
    it('is solved once its stars are the solution\'s, whatever crosses there are, and then takes no more marks', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        const empty = findEmptyCell();
        model.mark(empty, 'cross');
        for (let i = 0; i < STARS.length - 1; i++) model.mark(STARS[i], 'star');
        expect(model.isSolved).toBe(false);
        model.mark(STARS[STARS.length - 1], 'star');
        expect(model.isSolved).toBe(true);
        model.mark(empty, 'star');
        expect(model.markAt(empty)).toBe('cross');
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

    it('rings a group once, met by a star in it, broken by a cross in every cell, and undo takes the ring back', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        // Two cells side by side
        const a = PUZZLE.grid.size + 1;
        const b = a + 1;
        model.noteGroup([b, a]);
        model.noteGroup([a, b]);
        expect([model.groups.length, model.findGroup([a, b]), model.groupStateAt(0)]).toEqual([1, 0, 'open']);
        model.mark(a, 'cross');
        model.mark(b, 'cross');
        expect(model.groupStateAt(0)).toBe('broken');
        model.mark(b, 'star');
        expect(model.groupStateAt(0)).toBe('met');
        model.undo();
        model.undo();
        model.undo();
        expect([model.groups.length, model.markAt(a), model.markAt(b)]).toEqual([1, 'none', 'none']);
        model.undo();
        expect(model.groups.length).toBe(0);
    });

    it('rings only cells joined side to side, and clear of every other ring', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        const { size } = PUZZLE.grid;
        model.noteGroup([0, size + 1]);
        model.noteGroup([0, 2]);
        expect(model.groups.length).toBe(0);
        model.noteGroup([0, 1, size + 1]);
        model.noteGroup([size + 1, size + 2]);
        model.noteGroup([size + 2, size + 3]);
        expect(model.groups).toEqual([[0, 1, size + 1], [size + 2, size + 3]]);
    });

    it('comes back as it was saved, and starts afresh from a save of another puzzle', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        model.mark(STARS[0], 'star');
        model.mark(findEmptyCell(), 'cross');
        model.noteGroup([STARS[1], STARS[1] + 1]);
        const restored = createPuzzleModel({ puzzle: PUZZLE, saved: model.save() });
        expect(readMarks(restored)).toEqual(readMarks(model));
        expect(restored.groups).toEqual(model.groups);
        const other = createStarPuzzle({ seed: 2, settings: LEVEL_SETTINGS.hard });
        expect(readMarks(createPuzzleModel({ puzzle: other, saved: model.save() }))).toEqual(readMarks(createPuzzleModel({ puzzle: other })));
    });

    it('starts with its givens marked, as stars and crosses, which marks never change', () => {
        const model = createPuzzleModel({ puzzle: MADE });
        const given = MADE.givens.findIndex((state) => state !== UNKNOWN);
        const mark = model.markAt(given);
        expect([model.isGivenAt(given), mark]).toEqual([true, MADE.givens[given] === STAR ? 'star' : 'cross']);
        model.mark(given, 'none');
        expect([model.markAt(given), model.undoCount]).toEqual([mark, 0]);
    });
});

/** A cell the solution has no star in. */
function findEmptyCell(): number {
    return PUZZLE.solution.findIndex((state) => state !== STAR);
}

function readMarks(model: PuzzleModel): string[] {
    return Array.from({ length: model.puzzle.grid.cellCount }, (_, cell) => model.markAt(cell));
}
