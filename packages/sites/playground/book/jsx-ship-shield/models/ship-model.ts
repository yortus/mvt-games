// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long a shield lasts, in ms. */
const SHIELD_MS = 2000;
/** How long the ship takes to fly once round its loop, in ms. */
const LOOP_MS = 8000;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A ship that flies a slow loop around the middle of the play area. It
 * starts with its shield up, and the shield wears off after a while.
 * Positions are in world units, with the play area's top left corner at 0, 0.
 */
export interface ShipModel {
    readonly x: number;
    readonly y: number;
    readonly isShielded: boolean;
    /** Raises the shield, for as long as a new shield lasts. */
    readonly raiseShield: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShipModelOptions {
    /** The width of the play area, in world units. */
    readonly width: number;
    /** The height of the play area, in world units. */
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a ship with its shield up. */
export function createShipModel({ width, height }: ShipModelOptions): ShipModel {
    // How far round its loop the ship has flown, in ms
    let flownMs = 0;
    let shieldLeftMs = SHIELD_MS;
    let x = 0;
    let y = 0;
    moveAlongLoop();

    const model: ShipModel = {
        get x() { return x; },
        get y() { return y; },
        get isShielded() { return shieldLeftMs > 0; },

        raiseShield() {
            shieldLeftMs = SHIELD_MS;
        },

        update(deltaMs) {
            flownMs += deltaMs;
            shieldLeftMs = Math.max(0, shieldLeftMs - deltaMs);
            moveAlongLoop();
        },
    };

    return model;

    // A figure of eight, wider than it is tall, once every LOOP_MS
    function moveAlongLoop(): void {
        const angle = (flownMs / LOOP_MS) * Math.PI * 2;
        x = width / 2 + Math.sin(angle) * width * 0.3;
        y = height / 2 + Math.sin(angle * 2) * height * 0.22;
    }
}
