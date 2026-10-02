import type { Container } from 'pixi.js';
import { assert } from '#mvt-utils';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from './views';
import { SECTIONS, textures } from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createScrambleEntry(): GameEntry {
    let loaded = false;

    return {
        id: 'scramble',
        name: 'Scramble',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,
        thumbnailAdvanceMs: 1000,

        async load(): Promise<void> {
            await textures.load();
            loaded = true;
        },

        start(stage: Container): GameSession {
            assert(loaded, 'scramble: load() must be called before start()');

            const gameModel = createGameModel({
                sections: SECTIONS,
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
                    showSecondary: true,
                    primaryLabel: 'Fire',
                    secondaryLabel: 'Bomb',
                    onXDirectionChanged: (dir) => { gameModel.playerInput.xDirection = dir; },
                    onYDirectionChanged: (dir) => { gameModel.playerInput.yDirection = dir; },
                    onPrimaryButtonChanged: (pressed) => { gameModel.playerInput.firePressed = pressed; },
                    onSecondaryButtonChanged: (pressed) => { gameModel.playerInput.bombPressed = pressed; },
                    onRestartButtonChanged: (pressed) => { gameModel.playerInput.restartPressed = pressed; },
                },
            };
        },
    };
}
