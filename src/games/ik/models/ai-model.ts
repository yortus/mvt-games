import type { FighterModel } from './fighter-model';
import type { Facing, FighterMove, MoveKind } from '../data';
import { ARENA_MIN_X, ARENA_MAX_X } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface AiModel {
    update(deltaMs: number, opponent: FighterModel, self: FighterModel): void;
    readonly move: FighterMove;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AiModelOptions {
    /** How often the AI re-evaluates in ms (default 250). */
    reactionMs?: number;
    /** Probability 0..1 of attacking when in range (default 0.4). */
    aggressionPct?: number;
    /** Probability 0..1 of facing opponent for passive block (default 0.3). */
    blockChancePct?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum distance (metres) at which the AI considers itself in attack range. */
const ATTACK_RANGE = 1.8;

/** Distance below which the AI prefers to create a bit of space. */
const MIN_COMFORT_RANGE = 0.3;

/** Distance from arena edge where the AI avoids retreating further. */
const EDGE_MARGIN = 1.0;

/** Jitter added to the think timer (+-ms). */
const JITTER_MS = 50;

// ---------------------------------------------------------------------------
// Weighted move tables
// ---------------------------------------------------------------------------

interface WeightedMove {
    readonly move: MoveKind;
    readonly weight: number;
}

const ATTACK_MOVES: readonly WeightedMove[] = [
    // Simple grounded kicks (high weight)
    { move: 'high-kick', weight: 5 },
    { move: 'mid-kick', weight: 5 },
    { move: 'low-kick', weight: 4 },
    { move: 'foot-sweep', weight: 4 },

    // Punches
    { move: 'high-punch', weight: 3 },
    { move: 'crouch-punch', weight: 2 },

    // Medium-complexity
    { move: 'roundhouse', weight: 2 },

    // Complex/airborne (low weight)
    { move: 'flying-kick', weight: 1 },
    { move: 'front-somersault', weight: 1 },
];

const TOTAL_ATTACK_WEIGHT = ATTACK_MOVES.reduce((sum, m) => sum + m.weight, 0);

const WILDCARD_MOVES: readonly WeightedMove[] = [
    { move: 'back-lunge-punch', weight: 2 },
    { move: 'back-somersault', weight: 1 },
    { move: 'back-crouch-punch', weight: 1 },
    { move: 'back-low-kick', weight: 1 },
];

const TOTAL_WILDCARD_WEIGHT = WILDCARD_MOVES.reduce((sum, m) => sum + m.weight, 0);

/** Probability of a wildcard move instead of the normal decision tree. */
const WILDCARD_PCT = 0.08;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAiModel(options?: AiModelOptions): AiModel {
    const reactionMs = options?.reactionMs ?? 250;
    const aggressionPct = options?.aggressionPct ?? 0.4;
    const blockChancePct = options?.blockChancePct ?? 0.3;

    let thinkTimer = 0;
    let currentMove: FighterMove = 'idle';

    return {
        get move(): FighterMove {
            return currentMove;
        },

        update(deltaMs: number, opponent: FighterModel, self: FighterModel): void {
            thinkTimer -= deltaMs;
            if (thinkTimer > 0) return;

            // Reset timer with jitter
            thinkTimer = reactionMs + (Math.random() * 2 - 1) * JITTER_MS;

            const distance = Math.abs(self.x - opponent.x);
            const nearEdge = isNearBackEdge(self.x, self.facing);

            // --- Wildcard: low-probability back-move or somersault ---
            if (!nearEdge && Math.random() < WILDCARD_PCT) {
                currentMove = pickWeighted(WILDCARD_MOVES, TOTAL_WILDCARD_WEIGHT);
                return;
            }

            // --- Defensive: opponent is mid-attack and nearby ---
            const opponentAttacking = opponent.phase === 'attacking' || opponent.phase === 'airborne';
            if (opponentAttacking && distance < ATTACK_RANGE) {
                if (Math.random() < blockChancePct) {
                    // Face opponent and idle to enable passive blocking
                    currentMove = 'idle';
                }
                else if (!nearEdge && Math.random() < 0.3) {
                    // Occasionally retreat, but not when near edge
                    currentMove = 'walk-backward';
                }
                else {
                    // Counter-attack
                    currentMove = pickWeighted(ATTACK_MOVES, TOTAL_ATTACK_WEIGHT);
                }
                return;
            }

            // --- Too far: approach ---
            if (distance > ATTACK_RANGE) {
                currentMove = 'walk-forward';
                return;
            }

            // --- Too close: create space (only if not near edge) ---
            if (distance < MIN_COMFORT_RANGE && !nearEdge) {
                currentMove = 'walk-backward';
                return;
            }

            // --- In range: attack or adjust ---
            if (Math.random() < aggressionPct) {
                currentMove = pickWeighted(ATTACK_MOVES, TOTAL_ATTACK_WEIGHT);
            }
            else {
                // Idle or small forward adjustment (bias forward)
                currentMove = Math.random() < 0.25 ? 'walk-forward' : 'idle';
            }
        },
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickWeighted(options: readonly WeightedMove[], totalWeight: number): MoveKind {
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < options.length; i++) {
        roll -= options[i].weight;
        if (roll <= 0) return options[i].move;
    }
    return options[options.length - 1].move;
}

/** True when the fighter is close to the edge behind them. */
function isNearBackEdge(x: number, facing: Facing): boolean {
    if (facing === 'right') return x < ARENA_MIN_X + EDGE_MARGIN;
    return x > ARENA_MAX_X - EDGE_MARGIN;
}
