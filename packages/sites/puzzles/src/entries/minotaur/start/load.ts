import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createLocalStore, createMemoryStore } from '@mvtjs/site-kit/storage';
import { toDayNumber } from '../../../shared';
import { createGameModel, type GameModel, playShowcase } from '../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Minotaur. It makes its mazes as they open, and plays on the Audio90. */
export const load = definePixiLoader(async () => ({
    kind: 'pixi',
    soundChip: 'audio90',
    screenWidth: SCREEN_WIDTH,
    screenHeight: SCREEN_HEIGHT,

    start({ stage, sfx, isInPage }): EntrySession {
        const model = isInPage === true ? createPlayersModel() : createShowcaseModel();
        const view = GameView({ model, sfx });
        stage.addChild(view);

        return {
            // The host ticks the view with the rest of the stage
            update(deltaMs: number): void {
                model.update(deltaMs);
            },
            destroy(): void {
                // The last mark may have come since the last update
                model.keepProgress();
                stage.removeChild(view);
                view.destroy({ children: true });
            },
        };
    },
}));

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * In the page, the game is on today's date where the player is, from the
 * device's clock and time zone, and keeps the player's progress in the
 * browser.
 */
function createPlayersModel(): GameModel {
    const now = new Date();
    const today = toDayNumber({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
    return createGameModel({ today, store: createLocalStore(), offersIntro: true });
}

/**
 * Started headless, for the thumbnail or a visual test, the game is on a
 * fixed day, so its picture is the same whenever it is taken. It keeps
 * nothing, and shows a maze part built.
 */
function createShowcaseModel(): GameModel {
    const model = createGameModel({ today: SHOWCASE_DAY, store: createMemoryStore(), offersIntro: false });
    playShowcase(model);
    return model;
}

const SHOWCASE_DAY = toDayNumber({ year: 2026, month: 10, day: 30 });
