import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createGameModel } from './models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from './views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDojoDuelEntry(): GameEntry {
    return {
        id: 'dojo-duel',
        name: 'Dojo Duel',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 2000,
        instructions: [
            'First to 3 points wins a round;',
            'best of 3 rounds wins the match.',
            '',
            'Forward is toward your opponent.',
            '',
            'Without Attack:',
            '  Up: jump    Down: foot sweep',
            '  Up+Fwd: punch   Down+Fwd: kick',
            '',
            'With Attack:',
            '  Up: flying kick',
            '  Fwd: mid kick   Back: roundhouse',
            '  Up+Fwd / Up+Back: somersault',
            '',
            'Standing or walking while facing',
            'your opponent blocks some attacks.',
        ].join('\n'),

        start(stage: Container): GameSession {
            const gameModel = createGameModel();
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
