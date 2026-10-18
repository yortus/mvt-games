import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { createCoralModel } from '../models';
import { CoralView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Coral, which has no assets to load. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // Long enough for the first seeds to branch out
        thumbnailAdvanceMs: 15_000,

        start({ stage }): EntrySession {
            const model = createCoralModel();
            const view = CoralView({ model });
            stage.addChild(view);

            return {
                // The host ticks the view with the rest of the stage
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
