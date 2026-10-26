import { prepareAudio90Samples } from 'audio90';
import { definePixiLoader, type EntrySession } from '../../../entry-types';
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

        start({ stage, sound, bestScore }): EntrySession {
            const gameModel = createGameModel({ events: STAGE_EVENTS, bossAttacks: BOSS_ATTACKS });
            const gameView = GameView({ model: gameModel, sound, bestScore });
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
                inputConfig: {
                    showDpad: true,
                    showPrimary: true,
                    showSecondary: true,
                    primaryLabel: 'Bomb',
                    secondaryLabel: 'Focus',
                    onXDirectionChanged: (dir) => { gameModel.headingX = dir; },
                    onYDirectionChanged: (dir) => { gameModel.headingY = dir; },
                    onPrimaryButtonChanged: (isDown) => { if (isDown) gameModel.dropBomb(); },
                    onSecondaryButtonChanged: (isDown) => { gameModel.isFocusing = isDown; },
                    onRestartButtonChanged: (isDown) => { if (isDown) gameModel.startNewRun(); },
                },
            };
        },
    };
});
