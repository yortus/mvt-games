import { definePixiProject } from 'playground';
import { createCountdownModel } from './models';
import { CountdownView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the countdown lasts, in ms. */
const DURATION_MS = 13_000;
/** How much time a click adds while it counts, in ms. */
const ADDED_MS = 5000;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const WIDTH = 640;
const HEIGHT = 290;

/** What a click does, while the countdown counts and once it's done. Made once, so refresh makes no new strings. */
const COUNTING_HINT = `click to add ${ADDED_MS / 1000} seconds`;
const DONE_HINT = "time's up: click to start again";

// The project: a model of a countdown, and a view of it on the stage, which
// plays its sounds on the playground's sound chip. The wiring here decides
// what a click means: more time while it counts, and a fresh start once it
// has run out. The playground ticks what `start` returns, then updates and
// refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x10141f,
    start: ({ stage, sound }) => {
        const model = createCountdownModel({ durationMs: DURATION_MS });
        stage.addChild(CountdownView({
            secondsLeft: () => model.secondsLeft,
            phase: () => model.phase,
            sfx: sound,
            hint: () => (model.phase === 'counting' ? COUNTING_HINT : DONE_HINT),
            onTapped: () => (model.phase === 'counting' ? model.addTime(ADDED_MS) : model.restart()),
            width: WIDTH,
            height: HEIGHT,
        }));
        return model;
    },
});
