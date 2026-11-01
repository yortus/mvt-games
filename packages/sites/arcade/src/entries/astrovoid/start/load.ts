import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Astrovoid, which has no assets to load. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        soundChip: 'audio80',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,

        start({ stage, sfx }): EntrySession {
            const gameModel = createGameModel({
                arenaWidth: ARENA_WIDTH,
                arenaHeight: ARENA_HEIGHT,
            });

            const gameView = GameView({ model: gameModel, sfx });
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
                    // On a touch screen, a left-right pad turns, a button thrusts, and the game view fires
                    showDpad: true,
                    dpadKind: 'left-right',
                    showSecondary: true,
                    secondaryLabel: 'Thrust',
                    onXDirectionChanged: (dir) => { gameModel.turning = dir; },
                    onYDirectionChanged: (dir) => { gameModel.isThrusting = dir === 'up'; },
                    onPrimaryButtonChanged: (isDown) => { if (isDown) gameModel.fire(); },
                    onSecondaryButtonChanged: (isDown) => { gameModel.isThrusting = isDown; },
                    onRestartButtonChanged: (isDown) => { if (isDown) gameModel.startNewRun(); },
                },
            };
        },
    };
});
