import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createRandom } from '@mvtjs/site-kit/random';
import { createDemoModel } from '../models';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

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
            // A new seed each visit, so each visit's coral grows from new places
            const model = createDemoModel({ random: createRandom({ seed: Math.floor(Math.random() * 2 ** 32) }) });
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
