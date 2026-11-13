import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
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
        // On a touch screen, a finger held anywhere on the game view rises, so no touch controls are drawn
        arcadeControls: 'keys-only',
        // Far enough into the cave for it to have wound about
        thumbnailAdvanceMs: 2000,
        // Rise and sink in turn, so the submarine holds about level
        thumbnailInput: (controls, elapsedMs) => {
            controls.setHeld('script', 'primary', (elapsedMs + 75) % 300 < 150);
        },

        start({ stage, controls }): EntrySession {
            const gameModel = createGameModel();
            const gameView = GameView({ model: gameModel, controls });
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
            };
        },
    };
});
