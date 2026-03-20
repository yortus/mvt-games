import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createFighterModel, createPlayerInput, createPlaytestModel } from './models';
import { createPlaytestView } from './views';
import {
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    FIGHTER_START_LEFT_X,
    ARENA_MIN_X,
    ARENA_MAX_X,
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

            const playtest = createPlaytestModel(fighter, playerInput);
            const playtestView = createPlaytestView(fighter, playerInput);
            stage.addChild(playtestView);

            return {
                update(deltaMs: number): void {
                    playtest.update(deltaMs);
                },

                destroy(): void {
                    stage.removeChild(playtestView);
                    playtestView.destroy({ children: true });
                },
            };
        },
    };
}
