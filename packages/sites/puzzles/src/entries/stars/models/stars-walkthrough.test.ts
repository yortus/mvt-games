import { describe, expect, it } from 'vitest';
import { createWalkthroughModel, type DemoTouch, type WalkthroughModel } from '../../../shared';
import { STAR } from './cell-states';
import { PRACTICE_SEED, PRACTICE_SETTINGS } from './model-constants';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';
import { createStarPuzzle } from './star-puzzle';
import { STARS_WALKTHROUGH, type StarsTarget } from './stars-walkthrough';

describe('Stars\' walkthrough', () => {
    it('follows the solution: a dot where there is no star, a star where there is one, then dots round it, then Undo', () => {
        const puzzle = createPuzzleModel({ puzzle: createStarPuzzle({ seed: PRACTICE_SEED, settings: PRACTICE_SETTINGS }) });
        const walkthrough = createWalkthroughModel({ practice: puzzle, ...STARS_WALKTHROUGH });
        const { solution } = puzzle.puzzle;
        const steps: string[] = [];
        while (!walkthrough.isAtLastStep) {
            steps.push(walkthrough.stepName);
            doDemo(puzzle, walkthrough);
        }
        expect(steps).toEqual(['dot', 'star', 'drag', 'undo']);
        // What the demos marked, but the drag Undo took back, is right
        const cells = Array.from({ length: solution.length }, (_, cell) => cell);
        expect(cells.every((cell) => puzzle.markAt(cell) === 'none' || (puzzle.markAt(cell) === 'star') === (solution[cell] === STAR))).toBe(true);
        expect(walkthrough.demo).toEqual([]);
    });
});

/** Does what the step's demo shows, as the board and the puzzle's screen would, then moves the walkthrough on. */
function doDemo(puzzle: PuzzleModel, walkthrough: WalkthroughModel<StarsTarget>): void {
    for (let i = 0; i < walkthrough.demo.length; i++) doTouch(puzzle, walkthrough.demo[i]);
    walkthrough.update(0);
}

function doTouch(puzzle: PuzzleModel, touch: DemoTouch<StarsTarget>): void {
    const { size } = puzzle.puzzle.grid;
    const cells = touch.targets.map((target) => (target.on === 'grid' ? Math.floor(target.y) * size + Math.floor(target.x) : -1));
    if (touch.targets[0].on === 'undo') puzzle.undo();
    else if (touch.kind === 'drag') {
        puzzle.startStroke();
        for (let i = 0; i < cells.length; i++) if (puzzle.markAt(cells[i]) === 'none') puzzle.mark(cells[i], 'dot');
        puzzle.finishStroke();
    }
    else {
        // A tap moves a cell on from nothing, to a dot, to a star
        const taps = touch.kind === 'double-tap' ? 2 : 1;
        for (let i = 0; i < taps; i++) puzzle.mark(cells[0], puzzle.markAt(cells[0]) === 'none' ? 'dot' : 'star');
    }
}
