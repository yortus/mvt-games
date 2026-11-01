import { definePixiProject } from 'playground';
import { createBoardModel } from './models';
import { GameView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** When the project makes a match by itself, so you see one without clicking, in ms from the start. */
const DEMO_MATCH_MS = 500;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

// The project: a board of gems, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: 640,
    height: 360,
    background: 0x111827,
    start: ({ stage }) => {
        const model = createBoardModel();
        stage.addChild(GameView({ model }));

        // So you can see a celebration without clicking, the project makes
        // a match after half a second.
        let elapsedMs = 0;
        return {
            update(deltaMs) {
                if (elapsedMs < DEMO_MATCH_MS && elapsedMs + deltaMs >= DEMO_MATCH_MS) model.matchAt(2, 3);
                elapsedMs += deltaMs;
                model.update(deltaMs);
            },
        };
    },
});
