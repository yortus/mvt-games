import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { createCardRowModel } from '../models';
import { CardRowView } from '../views';

const SCREEN_WIDTH = 600;
const SCREEN_HEIGHT = 420;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start the reordering-lists demo, which has no assets to load. */
export async function load(): Promise<PixiEntryStarter> {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 2200,

        start({ stage }): EntrySession {
            const model = createCardRowModel();
            const view = CardRowView({ model });
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
