import { definePixiProject } from 'playground';
import { createGalleryModel } from './models';
import { GalleryView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** When the project opens a card by itself, so you see one open without clicking, in ms from the start. */
const DEMO_OPEN_MS = 1200;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const WIDTH = 640;
const HEIGHT = 360;

// The project: a gallery of cards, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x111827,
    start: ({ stage }) => {
        const model = createGalleryModel();
        stage.addChild(GalleryView({ model, width: WIDTH, height: HEIGHT }));

        // So you can see a card open without clicking, the project opens
        // one as it starts.
        let elapsedMs = 0;
        return {
            update(deltaMs) {
                if (elapsedMs < DEMO_OPEN_MS && elapsedMs + deltaMs >= DEMO_OPEN_MS) model.openCard(0);
                elapsedMs += deltaMs;
                model.update(deltaMs);
            },
        };
    },
});
