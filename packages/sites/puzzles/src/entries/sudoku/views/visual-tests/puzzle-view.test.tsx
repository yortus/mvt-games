import { canvasTest } from 'v-snap';
import type { SudokuModel } from '../../models';
import { PuzzleView } from '../puzzle-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { findEmptyCell, playSome, poseGame, solve, TODAY } from './sudoku-poses.test-support';

// The way in goes over the whole screen, so its card and walkthrough are posed in the whole screen's tests.

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('at the start', SIZE, () => pose(() => undefined));

canvasTest('part played, with notes', SIZE, () => pose(playSome));

canvasTest('a number filled in, selected to change or clear it, its key lit', SIZE, () => pose((model) => {
    playSome(model);
    // A digit that could go there, so it shows in blue
    const cell = findEmptyCell(model, 45);
    const candidates = model.puzzle?.candidatesAt(cell) ?? 0;
    model.puzzle?.fillCell(cell, Math.max(1, Math.log2(candidates & -candidates)));
    model.puzzle?.select([cell]);
}));

canvasTest('a digit that breaks a rule, in red, with those it clashes with', SIZE, () => pose((model) => {
    playSome(model);
    const cell = findEmptyCell(model, 36);
    const row = Math.floor(cell / 9) * 9;
    let given = 0;
    for (let i = 0; i < 9 && given === 0; i++) given = model.puzzle?.isGivenAt(row + i) === true ? model.puzzle.digitAt(row + i) : 0;
    model.puzzle?.fillCell(cell, given);
}));

canvasTest('solved', SIZE, () => pose(solve, 2000));

/** Today's puzzle, after `play` has played in it and `ms` has passed. The view shows only while a puzzle is open. */
function pose(play: (model: SudokuModel) => void, ms?: number) {
    const makeView = (model: SudokuModel) => {
        model.openPuzzle(TODAY);
        return PuzzleView({ model });
    };
    return poseGame(makeView, play, ms);
}
