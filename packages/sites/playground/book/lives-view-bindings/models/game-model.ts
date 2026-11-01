import { createShipModel, type ShipModel } from './ship-model';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How often player one's ship loses a life, in ms. */
const PLAYER_ONE_LIFE_LOST_EVERY_MS = 700;
/** How often player two's ship loses a life, in ms. */
const PLAYER_TWO_LIFE_LOST_EVERY_MS = 1100;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A game for two players, each with a ship. */
export interface GameModel {
    /** Player one's ship. */
    readonly ship: ShipModel;
    readonly player2: ShipModel;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a game whose two ships lose their lives at different rates. */
export function createGameModel(): GameModel {
    const ship = createShipModel({ lifeLostEveryMs: PLAYER_ONE_LIFE_LOST_EVERY_MS });
    const player2 = createShipModel({ lifeLostEveryMs: PLAYER_TWO_LIFE_LOST_EVERY_MS });

    return {
        ship,
        player2,
        update(deltaMs) {
            ship.update(deltaMs);
            player2.update(deltaMs);
        },
    };
}
