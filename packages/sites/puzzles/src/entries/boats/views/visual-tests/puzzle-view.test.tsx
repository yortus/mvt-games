import { canvasTest } from 'v-snap';
import type { PuzzleLevel } from '../../../../shared';
import { BOAT, playShowcase } from '../../models';
import { PuzzleView } from '../puzzle-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { type Play, poseGame, solve, TODAY } from './boats-poses.test-support';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('an easy harbour, at the start', SIZE, () => pose('easy', () => undefined));
canvasTest('an expert harbour, at the start', SIZE, () => pose('expert', () => undefined, 1300));
// The showcase opens a hard harbour, moors the boats of its top rows, and marks the water beside them
canvasTest('part solved, with boats moored and water marked', SIZE, () => poseGame((model) => {
    playShowcase(model);
    return PuzzleView({ model });
}, () => undefined, 900));

canvasTest('boats that break the rules: two touching diagonally, a boat too long, and a bend', SIZE, () => pose('hard', (model) => {
    const puzzle = model.puzzle!;
    const { size } = puzzle.puzzle.grid;
    // Two dinghies touching diagonally, top left
    puzzle.mark(size + 1, 'boat');
    puzzle.mark(size * 2 + 2, 'boat');
    // A boat of five cells along the bottom row, one longer than the fleet's longest
    for (let col = 0; col < 5; col++) puzzle.mark((size - 1) * size + col, 'boat');
    // An L, right
    puzzle.mark(size * 4 + size - 2, 'boat');
    puzzle.mark(size * 5 + size - 2, 'boat');
    puzzle.mark(size * 5 + size - 3, 'boat');
}));

canvasTest('the fleet ticked off as boats are finished', SIZE, () => pose('medium', (model) => {
    const puzzle = model.puzzle!;
    const { grid, solution } = puzzle.puzzle;
    // Every cell marked as the solution has it but the last boat cell, so every boat but the last is finished
    const last = solution.lastIndexOf(BOAT);
    for (let cell = 0; cell < grid.cellCount; cell++) {
        if (cell !== last) puzzle.mark(cell, solution[cell] === BOAT ? 'boat' : 'water');
    }
}));

canvasTest('solved, clear', SIZE, () => pose('easy', solve, 800));

/** The puzzle's screen, on today's harbour at `level`, after `play`. */
function pose(level: PuzzleLevel, play: Play, ms?: number) {
    return poseGame((model) => {
        model.calendar.chooseLevel(level);
        model.openPuzzle(TODAY);
        return PuzzleView({ model });
    }, play, ms);
}
