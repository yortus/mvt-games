import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createDemoModel } from '../models';
import { DemoView } from '../views';

const SCREEN_WIDTH = 600;
const SCREEN_HEIGHT = 420;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start the reordering-lists demo, which has no assets to load. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 2200,

        start({ stage }): EntrySession {
            const model = createDemoModel();
            const view = DemoView({ model });
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
