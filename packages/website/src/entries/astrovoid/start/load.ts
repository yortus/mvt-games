import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Astrovoid, which has no assets to load. */
export async function load(): Promise<PixiEntryStarter> {
    return {
        kind: 'pixi',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,

        start({ stage }): EntrySession {
            const gameModel = createGameModel({
                arenaWidth: ARENA_WIDTH,
                arenaHeight: ARENA_HEIGHT,
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
                    onXDirectionChanged: (dir) => { gameModel.playerInput.rotationDirection = dir; },
                    onYDirectionChanged: (dir) => { gameModel.playerInput.thrustPressed = dir === 'up'; },
                    onPrimaryButtonChanged: (pressed) => { gameModel.playerInput.firePressed = pressed; },
                    onRestartButtonChanged: (pressed) => { gameModel.playerInput.restartPressed = pressed; },
                },
            };
        },
    };
}
