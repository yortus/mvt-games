import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { createFireworksModel } from '../models';
import { FireworksView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start the fireworks, which have no assets to load. */
export async function load(): Promise<PixiEntryStarter> {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // Long enough for a few bursts
        thumbnailAdvanceMs: 3500,

        start({ stage }): EntrySession {
            const model = createFireworksModel();
            const view = FireworksView({ model });
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
