import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { createDiggerModel } from '../models';
import { DiggerView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Sudoku Digger, which has no assets to load. It plays on the Audio90. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        soundChip: 'audio90',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // Into the digging of the first puzzle, with holes dug and a cell being tested
        thumbnailAdvanceMs: 16_000,

        start({ stage, sfx }): EntrySession {
            // Each visit makes different puzzles. A test page fixes Math.random, so its puzzles are the same each run
            const model = createDiggerModel({ seed: Math.floor(Math.random() * 2 ** 32) });
            const view = DiggerView({ model, sfx });
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
