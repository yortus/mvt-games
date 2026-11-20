import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createLocalStore, createMemoryStore } from '@mvtjs/site-kit/storage';
import { PAPER_COLOR, toDayNumber } from '../../../shared';
import { createGameModel, type GameModel, playShowcase } from '../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Boats. It makes its puzzles as they open, and plays on the Audio90. */
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
            // The player's marks are saved as they go, so a restart clears the open puzzle once the player confirms
            restartQuestion: () => (model.canRestartPuzzle ? writeRestartQuestion(model.puzzle?.isSolved === true) : undefined),
            restart: model.restartPuzzle,
        };
    },
}));

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Creates the game as it plays in the page. It's set on today's date where
 * the player is, from the device's clock and time zone. It keeps the
 * player's progress in the browser.
 */
function createPlayersModel(): GameModel {
    const now = new Date();
    const today = toDayNumber({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
    return createGameModel({ today, store: createLocalStore(), offersIntro: true });
}

/**
 * Creates the game for when it starts headless, for the thumbnail or a
 * visual test. It's set on a fixed day, so its picture is the same each
 * time. It keeps nothing, and shows a puzzle part solved.
 */
function createShowcaseModel(): GameModel {
    const model = createGameModel({ today: SHOWCASE_DAY, store: createMemoryStore(), offersIntro: false });
    playShowcase(model);
    return model;
}

/** The day the game is set on when it starts headless, Friday 30 October 2026. The visual tests use the same day. */
const SHOWCASE_DAY = toDayNumber({ year: 2026, month: 10, day: 30 });

/** Returns the question the player confirms before a restart clears the open puzzle. */
function writeRestartQuestion(isSolved: boolean): string {
    return isSolved ? 'Clear this puzzle and solve it again? It stays ticked off on the calendar.' : 'Clear this puzzle and start it again?';
}
