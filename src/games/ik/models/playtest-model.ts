import { type FighterMove, resolveInputDirection, resolveMove } from '../data';
import type { FighterModel } from './fighter-model';
import type { PlayerInput } from './player-input';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface PlaytestModel {
    update(deltaMs: number): void;
}

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

export function createPlaytestModel(fighter: FighterModel, playerInput: PlayerInput): PlaytestModel {
    let settledMove: FighterMove = 'idle';
    let pendingMove: FighterMove = 'idle';
    let settleAccumMs = 0;
    let lastAcceptedMove: FighterMove = 'idle';
    let lastFacing = fighter.facing;

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
            }
            else if (rawMove !== pendingMove) {
                // Input changed - reset settle timer
                pendingMove = rawMove;
                settleAccumMs = deltaMs;
                settledMove = 'idle';
            }
            else {
                // Input stable - accumulate
                settleAccumMs += deltaMs;
            }

            if (settleAccumMs >= INPUT_SETTLE_MS) {
                settledMove = pendingMove;
            }

            if (settledMove !== lastAcceptedMove) {
                if (fighter.tryMove(settledMove)) {
                    lastAcceptedMove = settledMove;
                }
            }

            fighter.update(deltaMs);

            // Auto-turn moves flip facing mid-animation. Re-resolve the
            // tracked move so unchanged physical input isn't mistaken for
            // a new command after the facing change.
            if (fighter.facing !== lastFacing) {
                lastFacing = fighter.facing;
                const updatedDir = resolveInputDirection(
                    playerInput.xDirection,
                    playerInput.yDirection,
                    fighter.facing,
                );
                const updatedMove = resolveMove(updatedDir, playerInput.attackPressed);
                settledMove = updatedMove;
                pendingMove = updatedMove;
                lastAcceptedMove = updatedMove;
            }
        },
    };
}
