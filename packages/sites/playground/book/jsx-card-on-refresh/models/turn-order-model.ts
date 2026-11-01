// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long each turn lasts, before it passes to the next player, in ms. */
const TURN_MS = 1500;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Whose turn it is, among a few players sat round a table. Each turn lasts
 * a set time, then passes to the next player.
 */
export interface TurnOrderModel {
    /** The players' names, in the order they take their turns. */
    readonly players: readonly string[];
    /** The index of the player whose turn it is. */
    readonly currentPlayer: number;
    /** Gives the turn to a player, who then has a whole turn. */
    readonly giveTurnTo: (player: number) => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TurnOrderModelOptions {
    /** The players' names, in the order they take their turns. */
    readonly players: readonly string[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a turn order that starts with the first player. */
export function createTurnOrderModel({ players }: TurnOrderModelOptions): TurnOrderModel {
    let currentPlayer = 0;
    // How long the current turn has lasted, in ms
    let turnMs = 0;

    const model: TurnOrderModel = {
        players,
        get currentPlayer() { return currentPlayer; },

        giveTurnTo(player) {
            currentPlayer = player;
            turnMs = 0;
        },

        update(deltaMs) {
            turnMs += deltaMs;
            while (turnMs >= TURN_MS) {
                turnMs -= TURN_MS;
                currentPlayer = (currentPlayer + 1) % players.length;
            }
        },
    };

    return model;
}
