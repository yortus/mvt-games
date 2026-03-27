import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { createGameView } from './views';
import { ARENA_WIDTH, ARENA_HEIGHT, HUD_HEIGHT } from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAsteroidsEntry(): GameEntry {
    return {
        id: 'asteroids',
        name: 'Asteroids',
        screenWidth: ARENA_WIDTH,
        screenHeight: ARENA_HEIGHT + HUD_HEIGHT,

        start(stage: Container): GameSession {
            const gameModel = createGameModel({
                arenaWidth: ARENA_WIDTH,
                arenaHeight: ARENA_HEIGHT,
            });

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
