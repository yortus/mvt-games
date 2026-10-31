import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { createLocalStore, createMemoryStore } from '../../../storage';
import { loadSudokuGenerator, type SudokuGenerator } from '#sudoku-digger';
import { createSudokuModel, playShowcase, type SudokuModel, toDayNumber } from '../models';
import { SCREEN_HEIGHT, SCREEN_WIDTH, SudokuView } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Sudoku Digger's puzzle maker, and returns how to start Sudoku. It plays on the Audio90. */
export const load = definePixiLoader(async () => {
    const generate = await loadSudokuGenerator();
    return {
        kind: 'pixi',
        soundChip: 'audio90',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,

        start({ stage, sfx, isInPage }): EntrySession {
            const model = isInPage === true ? createPlayersModel(generate) : createShowcaseModel(generate);
            const view = SudokuView({ model, sfx });
            stage.addChild(view);

            return {
                // The host ticks the view with the rest of the stage
                update(deltaMs: number): void {
                    model.update(deltaMs);
                },
                destroy(): void {
                    // The last action may have come since the last update
                    model.keepProgress();
                    stage.removeChild(view);
                    view.destroy({ children: true });
                },
            };
        },
    };
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * In the Arcade's page, the game is on today's date where the player is,
 * from the device's clock and time zone, and keeps the player's progress
 * in the browser.
 */
function createPlayersModel(generate: SudokuGenerator): SudokuModel {
    const now = new Date();
    const today = toDayNumber({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
    return createSudokuModel({ today, store: createLocalStore(), generate, offersTutorial: true });
}

/**
 * Started headless, for the thumbnail or a visual test, the game is on a
 * fixed day, so its picture is the same whenever it is taken. It keeps
 * nothing, and shows a puzzle part played.
 */
function createShowcaseModel(generate: SudokuGenerator): SudokuModel {
    const model = createSudokuModel({ today: SHOWCASE_DAY, store: createMemoryStore(), generate, offersTutorial: false });
    playShowcase({ model, generate });
    return model;
}

const SHOWCASE_DAY = toDayNumber({ year: 2026, month: 10, day: 30 });
