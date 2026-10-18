import { definePixiLoader, type EntrySession } from '../../../entry-types';
import { createGameModel } from '../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Deep Dive, which has no assets to load. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // Far enough into the cave for it to have wound about
        thumbnailAdvanceMs: 2000,
        // Rise and sink in turn, so the submarine holds about level
        thumbnailInput: (session, elapsedMs) => {
            session.inputConfig?.onPrimaryButtonChanged?.((elapsedMs + 75) % 300 < 150);
        },

        start({ stage }): EntrySession {
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
                // The score is the whole metres dived, as the HUD shows it
                scoring: {
                    score: () => Math.floor(gameModel.distance),
                    isOver: () => gameModel.phase === 'crashed',
                },
                inputConfig: {
                    showPrimary: true,
                    primaryLabel: 'Rise',
                    // Rise, or up, blows the tanks for as long as it is held
                    onPrimaryButtonChanged: (isDown) => { gameModel.isBlowingTanks = isDown; },
                    onYDirectionChanged: (dir) => { gameModel.isBlowingTanks = dir === 'up'; },
                    onRestartButtonChanged: (isDown) => { if (isDown) gameModel.startNewRun(); },
                },
            };
        },
    };
});
