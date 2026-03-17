import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createFighterModel, createPlayerInput } from './models';
import { createPlaytestView } from './views';
import {
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    FIGHTER_START_LEFT_X,
    ARENA_MIN_X,
    ARENA_MAX_X,
    resolveInputDirection,
    textures,
} from './data';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createIkEntry(): GameEntry {
    let loaded = false;

    return {
        id: 'ik',
        name: 'International Karate',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,

        async load(): Promise<void> {
            await textures.load();
            loaded = true;
        },

        start(stage: Container): GameSession {
            if (!loaded) throw new Error('ik: load() must be called before start()');

            const playerInput = createPlayerInput();
            const fighter = createFighterModel({
                startX: FIGHTER_START_LEFT_X,
                startFacing: 'right',
                arenaMinX: ARENA_MIN_X,
                arenaMaxX: ARENA_MAX_X,
            });

            const playtestView = createPlaytestView(fighter, playerInput);
            stage.addChild(playtestView);

            return {
                update(deltaMs: number): void {
                    // Resolve input direction from raw axes + current facing
                    const inputDir = resolveInputDirection(
                        playerInput.xDirection,
                        playerInput.yDirection,
                        fighter.facing,
                    );

                    // Apply input then advance the fighter
                    fighter.applyInput(inputDir, playerInput.attackPressed);
                    fighter.update(deltaMs);
                },

                destroy(): void {
                    stage.removeChild(playtestView);
                    playtestView.destroy({ children: true });
                },
            };
        },
    };
}
