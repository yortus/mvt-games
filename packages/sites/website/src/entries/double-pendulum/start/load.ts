import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { createPendulumModel } from '../models';
import { PendulumView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start the double pendulum, which has no assets to load. */
export async function load(): Promise<PixiEntryStarter> {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // Long enough for the trail to fill
        thumbnailAdvanceMs: 4000,

        start({ stage }): EntrySession {
            const model = createPendulumModel();
            const view = PendulumView({ model });
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
}
