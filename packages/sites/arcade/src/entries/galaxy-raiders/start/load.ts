import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';
import { WAVES, textures } from '../data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Galaxy Raiders's textures, and returns how to start it. */
export const load = definePixiLoader(async () => {
    await textures.load();

    return {
        kind: 'pixi',
        soundChip: 'audio80',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,
        // On a touch screen, the game view's drag steers and fires, so no touch controls are drawn
        arcadeControls: 'keys-only',
        thumbnailAdvanceMs: THUMBNAIL_ADVANCE_MS,
        // Two shots on their way up as the thumbnail is taken
        thumbnailInput: (controls, elapsedMs) => {
            const isPressed = THUMBNAIL_SHOTS_MS.some((at) => elapsedMs >= at && elapsedMs < at + THUMBNAIL_PRESS_MS);
            controls.setHeld('script', 'primary', isPressed);
        },

        start({ stage, music, sfx, controls }): EntrySession {
            const gameModel = createGameModel({
                waves: WAVES,
            });

            const gameView = GameView({ model: gameModel, music, sfx, controls });
            stage.addChild(gameView);

            return {
                // The host ticks the view with the rest of the stage
                update(deltaMs: number): void {
                    gameModel.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(gameView);
                    gameView.destroy({ children: true });
                },
                scoring: {
                    score: () => gameModel.score,
                    isOver: () => gameModel.phase === 'game-over',
                },
                saveGame: gameModel.save,
                loadGame: gameModel.load,
            };
        },
    };
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Long enough for the raiders to fly into formation. */
const THUMBNAIL_ADVANCE_MS = 2000;

/** When the thumbnail's two shots are fired: late enough that both are still in the air. */
const THUMBNAIL_SHOTS_MS = [1500, 1750];

/**
 * How long each press is held: one step of the thumbnail's advance, which is
 * a frame. Each press then goes down in one step only, and fires one shot.
 */
const THUMBNAIL_PRESS_MS = 16;
