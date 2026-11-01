import { definePixiProject } from 'playground';
import { NO_MATCH_AFTER_SWAP, SWAP_DURATION_MS } from './data';
import { createSwapTrialModel } from './models';
import { TrialView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * How much time the right-hand board is given in each update, in ms. Three
 * swaps' worth is the whole run in one step, far bigger than any step a
 * game gives, and it ends only the first phase. Try 100, the ticker's cap,
 * or 16, a frame's worth, and that board passes too.
 */
const BIG_STEP_MS = 3 * SWAP_DURATION_MS;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const WIDTH = 640;
const HEIGHT = 360;

// The project: a trial that runs one test on two boards, over and over, and
// a view of it. The playground ticks the trial, which moves the boards on.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0f1a12,
    start: ({ stage }) => {
        const model = createSwapTrialModel({ startKinds: NO_MATCH_AFTER_SWAP, bigStepMs: BIG_STEP_MS });
        stage.addChild(TrialView({ model, width: WIDTH, height: HEIGHT }));
        return model;
    },
});
