import type { Container } from 'pixi.js';
import { assert } from '@mvtjs/utils';
import type { GameEntry, GameSession } from '../game-entry';
import { BOSS_ATTACKS, STAGE_EVENTS, textures } from './data';
import { createGameModel } from './models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from './views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createNeonMonsoonEntry(): GameEntry {
    let loaded = false;

    return {
        id: 'neon-monsoon',
        name: 'Neon Monsoon',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,
        // Long enough for the first kites to fly in.
        thumbnailAdvanceMs: 9000,
        instructions: [
            'Thread your tiny hitbox',
            'through the storm of bullets.',
            '',
            'Move: arrows / WASD / joystick',
            'Your ship fires on its own.',
            '',
            'Hold Shift (Focus) to fly',
            'slowly, show your hitbox and',
            'fire a narrow, strong shot.',
            '',
            'Space (Bomb) clears the screen',
            'and turns bullets into gems.',
            '',
            'Kill quickly to build a chain.',
            'Bullets that brush past score',
            'as grazes.',
        ].join('\n'),

        async load(): Promise<void> {
            await textures.load();
            loaded = true;
        },

        start(stage: Container): GameSession {
            assert(loaded, 'neon-monsoon: load() must be called before start()');

            const gameModel = createGameModel({ events: STAGE_EVENTS, bossAttacks: BOSS_ATTACKS });
            const gameView = GameView({ model: gameModel });
            stage.addChild(gameView);
            const input = gameModel.playerInput;

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
                    primaryLabel: 'Bomb',
                    secondaryLabel: 'Focus',
                    onXDirectionChanged: (dir) => { input.xDirection = dir; },
                    onYDirectionChanged: (dir) => { input.yDirection = dir; },
                    onPrimaryButtonChanged: (pressed) => { input.bombPressed = pressed; },
                    onSecondaryButtonChanged: (pressed) => { input.focusPressed = pressed; },
                    onRestartButtonChanged: (pressed) => { input.restartPressed = pressed; },
                },
            };
        },
    };
}
