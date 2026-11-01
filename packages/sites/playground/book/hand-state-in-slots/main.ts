import { definePixiProject } from 'playground';
import { createHandModel } from './models';
import { HandView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** When the project plays the middle card by itself, so you see it without clicking, in ms from the start. */
const DEMO_PLAY_MS = 1000;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

// The project: a hand of cards, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: 640,
    height: 360,
    background: 0x111827,
    start: ({ stage }) => {
        const model = createHandModel();
        stage.addChild(HandView({ model }));

        // So you can see what happens without clicking, the project plays
        // the middle card, C, after a second.
        let elapsedMs = 0;
        return {
            update(deltaMs) {
                if (elapsedMs < DEMO_PLAY_MS && elapsedMs + deltaMs >= DEMO_PLAY_MS) model.playAt(2);
                elapsedMs += deltaMs;
                model.update(deltaMs);
            },
        };
    },
});
