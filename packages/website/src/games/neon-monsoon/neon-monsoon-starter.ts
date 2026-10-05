import type { EntrySession, PixiEntryStarter } from '../../entries';
import { BOSS_ATTACKS, STAGE_EVENTS, textures } from './data';
import { createGameModel } from './models';
import { GameView, SCREEN_HEIGHT, SCREEN_WIDTH } from './views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Loads Neon Monsoon's textures, and returns how to start it. */
export async function loadNeonMonsoonStarter(): Promise<PixiEntryStarter> {
    await textures.load();

    return {
        kind: 'pixi',
        pixelArt: true,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        integerScale: true,
        // Long enough for the first kites to fly in.
        thumbnailAdvanceMs: 9000,

        start({ stage }): EntrySession {
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
