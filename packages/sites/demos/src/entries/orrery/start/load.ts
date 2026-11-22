import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createDemoModel } from '../models';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start the orrery. It doesn't load any assets, but importing it imports PixiJS 3D, through its views. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        soundChip: 'audio80',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // PixiJS 3D must be imported before the renderer starts
        draws3d: true,
        // Long enough for the arms to spread out round the sun
        thumbnailAdvanceMs: 5000,

        start({ stage, sfx }): EntrySession {
            const model = createDemoModel();
            const view = DemoView({ model, sfx });
            stage.addChild(view);

            return {
                // The host ticks the view with the rest of the stage, 3D scene included
                update(deltaMs: number): void {
                    model.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(view);
                    view.destroy({ children: true });
                },
            };
        },
    };
});
