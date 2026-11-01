import { definePixiProject } from 'playground';
import { createDiggerModel } from './models';
import { FieldView } from './views';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** When the project fires the harpoon by itself, so you see it without clicking, in ms from the start. */
const DEMO_FIRE_MS = 1200;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

// The project: a digger in a field, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: 640,
    height: 360,
    background: 0x111827,
    start: ({ stage }) => {
        const model = createDiggerModel();
        stage.addChild(FieldView({ model }));

        // So you can see the digger at work without clicking, the project
        // sends it across the field, and fires its harpoon on the way.
        let elapsedMs = 0;
        return {
            update(deltaMs) {
                if (elapsedMs === 0) model.walkTo(4, 6);
                if (elapsedMs < DEMO_FIRE_MS && elapsedMs + deltaMs >= DEMO_FIRE_MS) model.fireHarpoon();
                elapsedMs += deltaMs;
                model.update(deltaMs);
            },
        };
    },
});
