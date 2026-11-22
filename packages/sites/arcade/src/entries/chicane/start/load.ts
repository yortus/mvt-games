import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { COUNTDOWN_MS } from '../data';
import { createGameModel } from '../models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start Chicane. It doesn't load any assets, but importing it imports PixiJS 3D, through its views. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // PixiJS 3D must be imported before the renderer starts
        draws3d: true,
        // On a touch screen, a left-right pad steers, one button fires, and the other brakes. The car accelerates by itself
        arcadeControls: {
            showDpad: true,
            dpadKind: 'left-right',
            showPrimary: true,
            primaryLabel: 'Fire',
            showSecondary: true,
            secondaryLabel: 'Brake',
        },
        // The car pulls away down the start straight, firing at the rivals ahead, before it passes under the gantry
        thumbnailAdvanceMs: COUNTDOWN_MS + 1000,
        thumbnailInput: (controls) => {
            controls.setHeld('script', 'primary', true);
        },

        start({ stage, controls }): EntrySession {
            const gameModel = createGameModel();
            const gameView = GameView({ model: gameModel, controls });
            stage.addChild(gameView);

            return {
                // The host ticks the view with the rest of the stage, the 3D scene included
                update(deltaMs: number): void {
                    gameModel.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(gameView);
                    gameView.destroy({ children: true });
                },
            };
        },
    };
});
