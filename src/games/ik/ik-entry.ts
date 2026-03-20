import type { Container } from 'pixi.js';
import type { GameEntry, GameSession } from '../game-entry';
import { createFighterModel, createPlayerInput } from './models';
import { createPlaytestView } from './views';
import {
    type InputDirection,
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    FIGHTER_START_LEFT_X,
    ARENA_MIN_X,
    ARENA_MAX_X,
    resolveInputDirection,
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
            let settledDir: InputDirection = 'none';
            let settledAttack = false;
            let pendingDir: InputDirection = 'none';
            let pendingAttack = false;
            let settleAccumMs = 0;

            return {
                update(deltaMs: number): void {
                    // Resolve raw input each tick (facing may change mid-move)
                    const rawDir = resolveInputDirection(
                        playerInput.xDirection,
                        playerInput.yDirection,
                        fighter.facing,
                    );
                    const rawAttack = playerInput.attackPressed;

                    // Neutral input applies immediately (no delay on release)
                    if (rawDir === 'none' && !rawAttack) {
                        settledDir = 'none';
                        settledAttack = false;
                        pendingDir = 'none';
                        pendingAttack = false;
                        settleAccumMs = 0;
                    } else if (rawDir !== pendingDir || rawAttack !== pendingAttack) {
                        // Input changed - reset settle timer and clear stale settled value
                        pendingDir = rawDir;
                        pendingAttack = rawAttack;
                        settleAccumMs = deltaMs;
                        settledDir = 'none';
                        settledAttack = false;
                    } else {
                        // Input stable - accumulate
                        settleAccumMs += deltaMs;
                    }

                    if (settleAccumMs >= INPUT_SETTLE_MS) {
                        settledDir = pendingDir;
                        settledAttack = pendingAttack;
                    }

                    fighter.applyInput(settledDir, settledAttack);
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
