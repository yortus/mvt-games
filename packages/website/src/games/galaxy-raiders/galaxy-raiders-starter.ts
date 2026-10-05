import type { EntrySession, PixiEntryStarter } from '../../entries';
import { createGameModel } from './models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from './views';
import { WAVES, textures } from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Galaxy Raiders's textures, and returns how to start it. */
export async function loadGalaxyRaidersStarter(): Promise<PixiEntryStarter> {
    await textures.load();

    return {
        kind: 'pixi',
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

        start({ stage }): EntrySession {
            const gameModel = createGameModel({
                waves: WAVES,
            });

            const gameView = GameView({ model: gameModel });
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
                inputConfig: {
                    showDpad: true,
                    showPrimary: true,
                    primaryLabel: 'Fire',
                    onXDirectionChanged: (dir) => { gameModel.playerInput.direction = dir; },
                    onPrimaryButtonChanged: (pressed) => { gameModel.playerInput.firePressed = pressed; },
                    onRestartButtonChanged: (pressed) => { gameModel.playerInput.restartPressed = pressed; },
                },
            };
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Long enough for the raiders to fly into formation. */
const THUMBNAIL_ADVANCE_MS = 2000;

/** When the thumbnail's two shots are fired: late enough that both are still in the air. */
const THUMBNAIL_SHOTS_MS = [1500, 1750];

/** How long each press is held: a few frames. */
const THUMBNAIL_PRESS_MS = 50;
