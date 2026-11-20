import { describe, expect, it } from 'vitest';
import { createWalkthroughModel, type DemoTouch, type WalkthroughModel } from '../../../shared';
import { BOAT } from './cell-states';
import { PRACTICE_SEED, PRACTICE_SETTINGS } from './model-constants';
import { createBoatPuzzle } from './boat-puzzle';
import { BOATS_WALKTHROUGH, type BoatsTarget } from './boats-walkthrough';
import { type CellMark, createPuzzleModel, type PuzzleModel } from './puzzle-model';

describe('Boats\' walkthrough', () => {
    it('follows the solution: water where there is water, a boat where there is one, a sweep of water, then Undo', () => {
        const puzzle = createPuzzleModel({ puzzle: createBoatPuzzle({ seed: PRACTICE_SEED, settings: PRACTICE_SETTINGS }) });
        const walkthrough = createWalkthroughModel({ practice: puzzle, ...BOATS_WALKTHROUGH });
        const { solution } = puzzle.puzzle;
        const steps: string[] = [];
        while (!walkthrough.isAtLastStep) {
            steps.push(walkthrough.stepName);
            doDemo(puzzle, walkthrough);
        }
        expect(steps).toEqual(['water', 'boat', 'sweep', 'undo']);
        // What the demos marked is right, and Undo took back the sweep
        const cells = Array.from({ length: solution.length }, (_, cell) => cell);
        expect(cells.every((cell) => puzzle.markAt(cell) === 'none' || (puzzle.markAt(cell) === 'boat') === (solution[cell] === BOAT))).toBe(true);
        expect([puzzle.sweepsMade, puzzle.undosDone]).toEqual([1, 1]);
        expect(walkthrough.demo).toEqual([]);
    });
});

/** Does what the step's demo shows, as the board and the puzzle's screen would, then moves the walkthrough on. */
function doDemo(puzzle: PuzzleModel, walkthrough: WalkthroughModel<BoatsTarget>): void {
    for (let i = 0; i < walkthrough.demo.length; i++) doTouch(puzzle, walkthrough.demo[i]);
    walkthrough.update(0);
}

function doTouch(puzzle: PuzzleModel, touch: DemoTouch<BoatsTarget>): void {
    const { size } = puzzle.puzzle.grid;
    const cells = touch.targets.map((target) => (target.on === 'grid' ? Math.floor(target.y) * size + Math.floor(target.x) : -1));
    if (touch.targets[0].on === 'undo') puzzle.undo();
    else if (touch.kind === 'drag') {
        // A drag marks every cell from the first to the last as a tap would mark the first
        const mark = NEXT_MARKS[puzzle.markAt(cells[0])];
        puzzle.startStroke();
        for (let cell = cells[0]; cell <= cells[cells.length - 1]; cell++) puzzle.mark(cell, mark);
        puzzle.finishStroke();
    }
    else {
        const taps = touch.kind === 'double-tap' ? 2 : 1;
        for (let i = 0; i < taps; i++) puzzle.mark(cells[0], NEXT_MARKS[puzzle.markAt(cells[0])]);
    }
}

/** What a tap turns each mark into, as the puzzle's screen has it. */
const NEXT_MARKS: Readonly<Record<CellMark, CellMark>> = { none: 'water', water: 'boat', boat: 'none' };
