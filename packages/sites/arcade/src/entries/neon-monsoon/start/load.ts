import { prepareAudio90Samples } from 'audio90';
import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { BOSS_ATTACKS, SAMPLES, STAGE_EVENTS, textures } from '../data';
import { createGameModel } from '../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Neon Monsoon's textures, bounces its samples, and returns how to start it. It plays on the Audio90. */
export const load = definePixiLoader(async () => {
    await textures.load();
    prepareAudio90Samples(SAMPLES);

    return {
        kind: 'pixi',
        soundChip: 'audio90',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,
        // Long enough for the first kites to fly in.
        thumbnailAdvanceMs: 9000,
        // On a touch screen, a drag over the game view steers, so only Focus and Bomb are drawn.
        // Focus is held often, and a bomb is dropped rarely, so Focus is the primary button
        arcadeControls: { showPrimary: true, showSecondary: true, primaryLabel: 'Focus', secondaryLabel: 'Bomb' },

        start({ stage, music, sfx, bestScore, controls }): EntrySession {
            const gameModel = createGameModel({ events: STAGE_EVENTS, bossAttacks: BOSS_ATTACKS });
            const gameView = GameView({ model: gameModel, music, sfx, bestScore, controls });
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
                    score: () => gameModel.scoring.score,
                    // A run ends by losing every life, or by clearing both loops
                    isOver: () => gameModel.phase === 'game-over' || gameModel.phase === 'all-clear',
                },
                saveGame: gameModel.save,
                loadGame: gameModel.load,
            };
        },
    };
});
