import { definePixiLoader, type EntrySession } from '../../../entry-types';
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
        thumbnailAdvanceMs: THUMBNAIL_ADVANCE_MS,
        // Two shots on their way up as the thumbnail is taken
        thumbnailInput: (session, elapsedMs) => {
            const isPressed = THUMBNAIL_SHOTS_MS.some((at) => elapsedMs >= at && elapsedMs < at + THUMBNAIL_PRESS_MS);
            session.inputConfig?.onPrimaryButtonChanged?.(isPressed);
        },

        start({ stage, music, sfx }): EntrySession {
            const gameModel = createGameModel({
                waves: WAVES,
            });

            const gameView = GameView({ model: gameModel, music, sfx });
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
                inputConfig: {
                    showDpad: true,
                    showPrimary: true,
                    primaryLabel: 'Fire',
                    onXDirectionChanged: (dir) => { gameModel.direction = dir; },
                    onPrimaryButtonChanged: (isDown) => { if (isDown) gameModel.fire(); },
                    onRestartButtonChanged: (isDown) => { if (isDown) gameModel.startNewRun(); },
                },
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
