import type { Container } from 'pixi.js';
import { assert } from '#mvt-utils';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from './views';
import { WAVES, textures } from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGalagaEntry(): GameEntry {
    let loaded = false;

    return {
        id: 'galaga',
        name: 'Galaga',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,
        thumbnailAdvanceMs: 2000,

        async load(): Promise<void> {
            await textures.load();
            loaded = true;
        },

        start(stage: Container): GameSession {
            assert(loaded, 'galaga: preload() must be called before start()');

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
