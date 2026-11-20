import { describe, expect, it } from 'vitest';
import { GIVEN_DRY, NO_GIVEN } from './given-pieces';
import { LEVEL_SETTINGS } from './levels';
import { createPuzzleModel } from './puzzle-model';
import { createRiverPuzzle } from './river-puzzle';
import { RIVER } from './river-states';

// One puzzle for every test. Most tests take its givens away, so any edge can be drawn
const MADE = createRiverPuzzle({ seed: 1, settings: LEVEL_SETTINGS.medium });
const PUZZLE = { ...MADE, givens: new Uint8Array(MADE.grid.cellCount).fill(NO_GIVEN) };
const { size } = PUZZLE.grid;
const RIVER_EDGES: number[] = [];
for (let edge = 0; edge < PUZZLE.grid.edgeCount; edge++) {
    if (PUZZLE.solutionEdges[edge] === RIVER) RIVER_EDGES.push(edge);
}

describe('createPuzzleModel', () => {
    it('is solved once its river is the solution\'s, whatever meadows are marked, and then takes no more marks', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        const dry = PUZZLE.solutionCells.indexOf(2);
        model.setMeadow(dry, true);
        for (let i = 0; i < RIVER_EDGES.length - 1; i++) model.setRiver(RIVER_EDGES[i], true);
        expect(model.isSolved).toBe(false);
        model.setRiver(RIVER_EDGES[RIVER_EDGES.length - 1], true);
        expect(model.isSolved).toBe(true);
        model.setMeadow(dry, false);
        expect(model.isMeadowAt(dry)).toBe(true);
    });

    it('points out a loop, a cell with three river sides, and river through a meadow', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        const { edgeBetween } = PUZZLE.grid;
        // A loop round the four cells in the middle
        const a = 3 * size + 3;
        model.startStroke();
        model.setRiver(edgeBetween(a, a + 1), true);
        model.setRiver(edgeBetween(a + 1, a + 1 + size), true);
        model.setRiver(edgeBetween(a + 1 + size, a + size), true);
        model.setRiver(edgeBetween(a + size, a), true);
        model.finishStroke();
        expect([model.isClashAt(a), model.isClashAt(a + size + 1), model.clashesMade]).toEqual([true, true, 1]);
        model.undo();
        // A cell with a third river side, and a meadow with river through it
        model.setRiver(edgeBetween(a, a + 1), true);
        model.setRiver(edgeBetween(a, a - 1), true);
        model.setRiver(edgeBetween(a, a - size), true);
        model.setMeadow(a + 1, true);
        expect([model.isClashAt(a), model.isClashAt(a + 1)]).toEqual([true, true]);
    });

    it('undoes a stroke of several edges as one', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        model.startStroke();
        model.setRiver(0, true);
        model.setRiver(1, true);
        model.finishStroke();
        expect([model.riverDrawn, model.undoCount]).toEqual([2, 1]);
        model.undo();
        expect([model.isRiverAt(0), model.isRiverAt(1), model.undoCount]).toEqual([false, false, 0]);
    });

    it('keeps the edges round a given cell as they are', () => {
        const givens = new Uint8Array(PUZZLE.grid.cellCount).fill(NO_GIVEN);
        const cell = 3 * size + 3;
        givens[cell] = GIVEN_DRY;
        const model = createPuzzleModel({ puzzle: { ...PUZZLE, givens } });
        model.setRiver(PUZZLE.grid.edgeBetween(cell, cell + 1), true);
        expect([model.isMeadowAt(cell), model.riverDrawn, model.changes]).toEqual([true, 0, 0]);
    });

    it('restores its marks from a save of the same puzzle, and ignores a save of another', () => {
        const model = createPuzzleModel({ puzzle: PUZZLE });
        model.setRiver(5, true);
        model.setMeadow(6, true);
        const restored = createPuzzleModel({ puzzle: PUZZLE, saved: model.save() });
        expect([restored.isRiverAt(5), restored.isMeadowAt(6)]).toEqual([true, true]);
        const other = createRiverPuzzle({ seed: 2, settings: LEVEL_SETTINGS.medium });
        expect(createPuzzleModel({ puzzle: other, saved: model.save() }).isRiverAt(5)).toBe(false);
        expect(createPuzzleModel({ puzzle: PUZZLE, saved: { puzzle: 'nonsense', rivers: '9', meadows: '' } }).isRiverAt(5)).toBe(false);
    });
});
