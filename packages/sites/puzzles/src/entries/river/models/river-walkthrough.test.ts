import { describe, expect, it } from 'vitest';
import { createWalkthroughModel, type DemoTouch, type WalkthroughModel } from '../../../shared';
import { RIVER_WALKTHROUGH, type RiverTarget } from './river-walkthrough';
import { PRACTICE_SEED, PRACTICE_SETTINGS } from './model-constants';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';
import { createRiverPuzzle } from './river-puzzle';
import { DRY } from './river-states';

describe('River\'s walkthrough', () => {
    it('follows the solution: a meadow where the river keeps away, a reach of river where it runs, rubbed out, then Undo', () => {
        const puzzle = createPuzzleModel({ puzzle: createRiverPuzzle({ seed: PRACTICE_SEED, settings: PRACTICE_SETTINGS }) });
        const walkthrough = createWalkthroughModel({ practice: puzzle, ...RIVER_WALKTHROUGH });
        const steps: string[] = [];
        while (!walkthrough.isAtLastStep) {
            steps.push(walkthrough.stepName);
            doDemo(puzzle, walkthrough);
        }
        expect(steps).toEqual(['meadow', 'river', 'rub', 'undo']);
        // Undo took back the rubbing out, so the river drawn is back, and the meadow is where the river keeps away
        const { solutionCells } = puzzle.puzzle;
        const cells = Array.from({ length: solutionCells.length }, (_, cell) => cell);
        expect(cells.every((cell) => !puzzle.isMeadowAt(cell) || solutionCells[cell] === DRY)).toBe(true);
        expect([puzzle.riverDrawn, puzzle.riverCleared, puzzle.undosDone]).toEqual([1, 1, 1]);
        expect(walkthrough.demo).toEqual([]);
    });
});

/** Does what the step's demo shows, as the board and the puzzle's screen would, then moves the walkthrough on. */
function doDemo(puzzle: PuzzleModel, walkthrough: WalkthroughModel<RiverTarget>): void {
    for (let i = 0; i < walkthrough.demo.length; i++) doTouch(puzzle, walkthrough.demo[i]);
    walkthrough.update(0);
}

function doTouch(puzzle: PuzzleModel, touch: DemoTouch<RiverTarget>): void {
    const { grid } = puzzle.puzzle;
    const cells = touch.targets.map((target) => (target.on === 'grid' ? Math.floor(target.y) * grid.size + Math.floor(target.x) : -1));
    if (touch.targets[0].on === 'undo') puzzle.undo();
    else if (touch.kind === 'drag') {
        // A drag across an edge draws the river there, or rubs it out if it is drawn already
        const edge = grid.edgeBetween(cells[0], cells[1]);
        puzzle.setRiver(edge, !puzzle.isRiverAt(edge));
    }
    else puzzle.setMeadow(cells[0], !puzzle.isMeadowAt(cells[0]));
}
