import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { createForestModel } from '../models';
import { ForestView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Fractal Forest, which has no assets to load. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // Early autumn: the trees full grown, their leaves starting to turn
        thumbnailAdvanceMs: 36_000,

        start({ stage }): EntrySession {
            const model = createForestModel();
            const view = ForestView({ model });
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
