import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView } from './views';
import { SCREEN_WIDTH, SCREEN_HEIGHT, textures } from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createIkEntry(): GameEntry {
    let loaded = false;

    return {
        id: 'ik',
        name: 'International Karate',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 2000,

        async load(): Promise<void> {
            await textures.load();
            loaded = true;
        },

        start(stage: Container): GameSession {
            if (!loaded) throw new Error('ik: load() must be called before start()');

            const gameModel = createGameModel();
            const gameView = createGameView(gameModel);
            stage.addChild(gameView);

            return {
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
                    primaryLabel: 'Atk',
                    onXDirectionChanged: (dir) => { gameModel.playerInput.xDirection = dir; },
                    onYDirectionChanged: (dir) => { gameModel.playerInput.yDirection = dir; },
                    onPrimaryButtonChanged: (pressed) => { gameModel.playerInput.attackPressed = pressed; },
                    onRestartButtonChanged: (pressed) => { gameModel.playerInput.restartPressed = pressed; },
                },
            };
        },
    };
}
