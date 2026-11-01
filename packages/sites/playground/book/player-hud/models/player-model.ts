// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The points each coin is worth. */
const COIN_POINTS = 50;
/** How long the player stays hurt after a hit, in ms. A hurt player can't be hit again. */
const HURT_MS = 500;
/** How long a power-up works, in ms. Another can't be picked up until it ends. */
const BUFF_MS = 3000;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A player who collects coins, gets hurt, and picks up power-ups. Being hurt
 * lasts a moment, and a power-up lasts a few seconds. Neither can start
 * again while it's still going: a hurt player can't be hit, and a player
 * with a power-up can't pick up another.
 */
export interface PlayerModel {
    readonly score: number;
    /** Whether the player is hurt, for a moment after each hit. */
    readonly isHurt: boolean;
    /** Whether a power-up is working. */
    readonly isBuffed: boolean;
    readonly collectCoin: () => void;
    /** Hurts the player, unless they're hurt already. */
    readonly takeHit: () => void;
    /** Starts a power-up, unless one is working already. */
    readonly pickUpPowerUp: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a player with no score, unhurt and with no power-up. */
export function createPlayerModel(): PlayerModel {
    let score = 0;
    // How much longer the player is hurt, and buffed, in ms
    let hurtMs = 0;
    let buffMs = 0;

    const model: PlayerModel = {
        get score() { return score; },
        get isHurt() { return hurtMs > 0; },
        get isBuffed() { return buffMs > 0; },

        collectCoin() {
            score += COIN_POINTS;
        },

        takeHit() {
            if (hurtMs > 0) return;
            hurtMs = HURT_MS;
        },

        pickUpPowerUp() {
            if (buffMs > 0) return;
            buffMs = BUFF_MS;
        },

        update(deltaMs) {
            hurtMs = Math.max(0, hurtMs - deltaMs);
            buffMs = Math.max(0, buffMs - deltaMs);
        },
    };

    return model;
}
