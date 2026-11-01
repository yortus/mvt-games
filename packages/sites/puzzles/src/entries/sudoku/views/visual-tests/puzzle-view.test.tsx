import { canvasTest } from 'v-snap';
import { type SudokuModel, type TutorialStep, TUTORIAL_STEPS } from '../../models';
import { PuzzleView } from '../puzzle-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { findEmptyCell, playSome, poseGame, solve, TODAY } from './sudoku-poses.test-support';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('at the start', SIZE, () => pose(() => undefined));

canvasTest('part played, with notes', SIZE, () => pose(playSome));

canvasTest('choosing a number', SIZE, () => pose((model) => {
    playSome(model);
    model.puzzle?.openPicker(findEmptyCell(model, 40));
}));

canvasTest('choosing a number near the bottom, which opens above the cell', SIZE, () => pose((model) => {
    playSome(model);
    model.puzzle?.openPicker(findEmptyCell(model, 70));
}));

canvasTest('changing a number filled in, which is lit', SIZE, () => pose((model) => {
    playSome(model);
    const cell = findEmptyCell(model, 45);
    model.puzzle?.openPicker(cell);
    model.puzzle?.fillIn(4);
    model.puzzle?.openPicker(cell);
}));

canvasTest('a digit that breaks a rule, in red, with those it clashes with', SIZE, () => pose((model) => {
    playSome(model);
    const cell = findEmptyCell(model, 36);
    const row = Math.floor(cell / 9) * 9;
    let given = 0;
    for (let i = 0; i < 9 && given === 0; i++) given = model.puzzle?.isGivenAt(row + i) === true ? model.puzzle.digitAt(row + i) : 0;
    model.puzzle?.openPicker(cell);
    model.puzzle?.fillIn(given);
}));

// The arrow's show starts as each demo does: it comes in for 600 ms, then each tap's touch lasts 150 ms and its lift 300
// (110 each in a double tap), and moving from a cell to a key takes 760
canvasTest('the tutorial, at its first step, its arrow tapping a cell', SIZE, () => pose(startTutorialAt('select'), 680));
canvasTest('the tutorial, its arrow tapping a second digit on the keypad', SIZE, () => pose(startTutorialAt('mark'), 1490));
canvasTest('the tutorial, its arrow partway through linking two cells', SIZE, () => pose(startTutorialAt('link'), 1300));
canvasTest('the tutorial, its arrow double-tapping a digit to fill the cell it selected', SIZE, () => pose(startTutorialAt('fill'), 1700));
canvasTest('the tutorial, at its last step', SIZE, () => pose(startTutorialAt('done')));

canvasTest('solved', SIZE, () => pose(solve, 2000));

/** Starts the tutorial, and does what each step's demo shows until it is at `step`. */
function startTutorialAt(step: TutorialStep): (model: SudokuModel) => void {
    return (model) => {
        model.startTutorial();
        for (let i = 0; i < TUTORIAL_STEPS.length && model.tutorial !== undefined && model.tutorial.step !== step; i++) {
            const { demo, demoCells, demoDigits } = model.tutorial;
            if (demo === 'select' || demo === 'link') model.puzzle?.select(demoCells);
            if (demo === 'note') demoDigits.forEach((digit) => model.puzzle?.toggleNote(digit));
            if (demo === 'fill') model.puzzle?.fillCell(demoCells[0], demoDigits[0]);
            model.update(16);
            model.update(16);
        }
    };
}

/** Today's puzzle, after `play` has played in it and `ms` has passed. The view shows only while a puzzle is open. */
function pose(play: (model: SudokuModel) => void, ms?: number) {
    const makeView = (model: SudokuModel) => {
        model.openPuzzle(TODAY);
        return PuzzleView({ model });
    };
    return poseGame(makeView, play, ms);
}
