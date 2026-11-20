import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createLocalStore, createMemoryStore } from '@mvtjs/site-kit/storage';
import { PAPER_COLOR, toDayNumber } from '../../../shared';
import { createGameModel, type GameModel, playShowcase } from '../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start River. It makes its puzzles as they open, and plays on the Audio90. */
export const load = definePixiLoader(async () => ({
    kind: 'pixi',
    soundChip: 'audio90',
    screenWidth: SCREEN_WIDTH,
    screenHeight: SCREEN_HEIGHT,
    // The paper goes on past the play area, to the screen's edges
    backgroundColor: PAPER_COLOR,

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
            // The player's marks are kept as they go. A restart clears the open puzzle, once the player confirms it
            restartQuestion: () => (model.canRestartPuzzle ? writeRestartQuestion(model.puzzle?.isSolved === true) : undefined),
            restart: model.restartPuzzle,
        };
    },
}));

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Creates the game for a player in the page. It opens on today's date where
 * they are, from the device's clock and time zone, and saves their progress
 * in the browser.
 */
function createPlayersModel(): GameModel {
    const now = new Date();
    const today = toDayNumber({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
    return createGameModel({ today, store: createLocalStore(), offersIntro: true });
}

/**
 * Creates the game for a headless start, such as the thumbnail or a visual
 * test. It's on a fixed day, so its picture is the same whenever it's
 * taken. It doesn't save anything, and it shows a puzzle part solved.
 */
function createShowcaseModel(): GameModel {
    const model = createGameModel({ today: SHOWCASE_DAY, store: createMemoryStore(), offersIntro: false });
    playShowcase(model);
    return model;
}

/** The day that the headless game is on. */
const SHOWCASE_DAY = toDayNumber({ year: 2026, month: 10, day: 30 });

/** Returns the question that the player confirms before a restart clears the open puzzle. */
function writeRestartQuestion(isSolved: boolean): string {
    return isSolved ? 'Clear this puzzle and solve it again? It stays ticked off on the calendar.' : 'Clear this puzzle and start it again?';
}
