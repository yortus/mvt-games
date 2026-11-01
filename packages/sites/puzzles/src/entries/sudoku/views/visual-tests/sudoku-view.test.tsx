import { createHeadlessAudio90 } from 'audio90/headless';
import { canvasTest } from 'v-snap';
import type { SudokuModel } from '../../models';
import { SudokuView } from '../sudoku-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';
import { type Play, playSome, poseGame, TODAY } from './sudoku-poses.test-support';

// The screens themselves are tested in their own views' tests. These show the whole screen switching between them, and
// the way in over them.

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

canvasTest('the calendar', SIZE, () => pose(() => undefined));
canvasTest('a puzzle', SIZE, () => pose(playSome));
// The puzzle's screen is kept, hidden, while the calendar shows, and its update steps must not read the puzzle that closed
canvasTest('back on the calendar from a puzzle', SIZE, () => pose([playSome, (model) => model.closePuzzle()]));

// The way in: the card, as the game first opens, then the walkthrough from it. The arrow's show starts as each demo
// does: it comes in for 600 ms, then each tap's touch lasts 150 ms and its lift 300, a hold stays down 1,100 ms more,
// and moving from a cell to a key takes 760
canvasTest('how to play, on its card over the calendar', SIZE, () => pose((model) => model.intro.showCard()));
canvasTest('the walkthrough, from the calendar, at its first step, its arrow tapping a cell', SIZE, () => pose(startWalkthroughAt('select'), 680));
canvasTest('the walkthrough, its arrow tapping a second digit on the keypad', SIZE, () => pose(startWalkthroughAt('mark'), 1490));
canvasTest('the walkthrough, its arrow partway through linking two cells', SIZE, () => pose(startWalkthroughAt('link'), 1300));
canvasTest('the walkthrough, its arrow holding a digit to fill the cell selected, its ring half full', SIZE, () => pose(startWalkthroughAt('fill'), 2500));
canvasTest('the walkthrough, at its last step', SIZE, () => pose(startWalkthroughAt('done')));
canvasTest('the walkthrough, from a puzzle', SIZE, () => pose([
    (model) => model.openPuzzle(TODAY),
    startWalkthroughAt('select'),
], 680));

/** Starts the walkthrough from the card, and does what each step's demo shows until it is at `step`. */
function startWalkthroughAt(step: string): (model: SudokuModel) => void {
    return (model) => {
        model.intro.showCard();
        model.intro.startWalkthrough();
        for (let i = 0; i < 10 && model.intro.walkthrough !== undefined && model.intro.walkthrough.stepName !== step; i++) {
            const targets = model.intro.walkthrough.demo.flatMap((touch) => touch.targets);
            const cells = targets.flatMap((target) => (target.on === 'cell' ? [target.cell] : []));
            const digits = targets.flatMap((target) => (target.on === 'key' ? [target.digit] : []));
            if (model.intro.walkthrough.stepName === 'fill') model.puzzle?.fillCell(cells[0], digits[0]);
            else {
                if (cells.length > 0) model.puzzle?.select(cells);
                digits.forEach((digit) => model.puzzle?.toggleNote(digit));
            }
            model.update(16);
            model.update(16);
        }
    };
}

function pose(play: Play | readonly Play[], ms?: number) {
    // A headless chip makes no sound, and an image does not depend on what plays
    return poseGame((model) => SudokuView({ model, sfx: createHeadlessAudio90() }), play, ms);
}
