// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How many coins earn an extra life. */
const COINS_PER_LIFE = 5;
/** How long until a coin is picked up on its own, if you don't click, in ms. */
const COIN_EVERY_MS = 600;
/** How many lives the player starts with. */
const START_LIVES = 3;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The events this model sends. */
export type PlayerEventKind = 'coins-changed';

/**
 * A player who picks up coins. Every fifth coin turns into an extra life:
 * the coins go back to 0, and the lives go up by one. So once an update is
 * over, the player never holds five coins.
 *
 * This model also tells listeners about a change the moment it makes it,
 * which an MVT model never needs to do. It's here to show what goes wrong.
 */
export interface PlayerModel {
    /** The coins toward the next life, from 0 to one less than `coinsPerLife`. */
    readonly coins: number;
    /** How many coins earn an extra life. */
    readonly coinsPerLife: number;
    readonly lives: number;
    /** Picks up a coin at the next update. */
    readonly pickUpCoin: () => void;
    /** Calls `listener` each time the model sends this event. Returns a function that stops it. */
    readonly addListener: (kind: PlayerEventKind, listener: () => void) => () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a player with no coins and three lives. A coin is picked up every so often. */
export function createPlayerModel(): PlayerModel {
    let coins = 0;
    let lives = START_LIVES;
    let pickedUpCoin = false;
    // How long since a coin was last picked up, in ms
    let sinceCoinMs = 0;
    const listeners: (() => void)[] = [];

    const model: PlayerModel = {
        get coins() { return coins; },
        coinsPerLife: COINS_PER_LIFE,
        get lives() { return lives; },

        pickUpCoin() {
            pickedUpCoin = true;
        },

        addListener(_kind, listener) {
            listeners.push(listener);
            return () => {
                const index = listeners.indexOf(listener);
                if (index >= 0) listeners.splice(index, 1);
            };
        },

        update(deltaMs) {
            sinceCoinMs += deltaMs;
            if (sinceCoinMs >= COIN_EVERY_MS) pickedUpCoin = true;

            if (pickedUpCoin) {
                coins++;
                emit('coins-changed'); // every listener runs now, mid-update
                if (coins === COINS_PER_LIFE) {
                    coins = 0;
                    lives++;
                }
                pickedUpCoin = false;
                sinceCoinMs = 0;
            }
        },
    };

    return model;

    function emit(_kind: PlayerEventKind): void {
        for (let i = 0; i < listeners.length; i++) listeners[i]();
    }
}
