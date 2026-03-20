import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createFighterModel, createPlayerInput } from './models';
import { createPlaytestView } from './views';
import {
    type FighterMove,
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    FIGHTER_START_LEFT_X,
    ARENA_MIN_X,
    ARENA_MAX_X,
    resolveInputDirection,
    resolveMove,
    textures,
} from './data';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Time in ms that a non-neutral input must be stable before it is committed
 * to the fighter. This lets key combos (e.g. up+right+fire) settle across
 * multiple frames without triggering intermediate single-key moves.
 */
const INPUT_SETTLE_MS = 50;

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

            // --- Input settling state ---
            let settledMove: FighterMove = 'idle';
            let pendingMove: FighterMove = 'idle';
            let settleAccumMs = 0;

            return {
                update(deltaMs: number): void {
                    // Resolve raw input to a FighterMove each tick
                    const rawDir = resolveInputDirection(
                        playerInput.xDirection,
                        playerInput.yDirection,
                        fighter.facing,
                    );
                    const rawMove = resolveMove(rawDir, playerInput.attackPressed);

                    // Neutral move applies immediately (no delay on release)
                    if (rawMove === 'idle') {
                        settledMove = 'idle';
                        pendingMove = 'idle';
                        settleAccumMs = 0;
                    } else if (rawMove !== pendingMove) {
                        // Input changed - reset settle timer
                        pendingMove = rawMove;
                        settleAccumMs = deltaMs;
                        settledMove = 'idle';
                    } else {
                        // Input stable - accumulate
                        settleAccumMs += deltaMs;
                    }

                    if (settleAccumMs >= INPUT_SETTLE_MS) {
                        settledMove = pendingMove;
                    }

                    fighter.tryMove(settledMove);
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
