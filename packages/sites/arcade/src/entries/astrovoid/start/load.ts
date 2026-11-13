import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { isTouchDevice } from '@mvtjs/site-kit/device';
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
        // On a touch screen, a left-right pad turns and a button thrusts. The ship fires on its own
        arcadeControls: { showDpad: true, dpadKind: 'left-right', showSecondary: true, secondaryLabel: 'Thrust' },

        start({ stage, sfx, controls }): EntrySession {
            const gameModel = createGameModel({
                arenaWidth: ARENA_WIDTH,
                arenaHeight: ARENA_HEIGHT,
            });
            // On a touch screen, the ship fires on its own, so the thumbs are free to fly it
            gameModel.isAutoFiring = isTouchDevice();

            const gameView = GameView({ model: gameModel, sfx, controls });
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
            };
        },
    };
});
