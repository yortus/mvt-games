import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_WIDTH, SCREEN_HEIGHT } from '../views';
import { FIELD_ROWS, FIELD_COLS, BASE_FIELD, DIGGER_SPAWN, LEVELS, textures } from '../data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Burrow Bust's textures, and returns how to start it. */
export const load = definePixiLoader(async () => {
    await textures.load();

    return {
        kind: 'pixi',
        soundChip: 'audio80',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,
        // On a touch screen, a swipe held over the game view steers, so only Pump is drawn
        arcadeControls: { showPrimary: true, primaryLabel: 'Pump' },

        start({ stage, music, sfx, controls }): EntrySession {
            const gameModel = createGameModel({
                levels: LEVELS,
                fieldCols: FIELD_COLS,
                fieldRows: FIELD_ROWS,
                baseLayout: BASE_FIELD,
                diggerSpawn: DIGGER_SPAWN,
            });

            const gameView = GameView({ model: gameModel, music, sfx, controls });
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
