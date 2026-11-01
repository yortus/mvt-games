// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the field stays empty before new rocks appear, in ms. */
const REFILL_MS = 2000;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A rock in the field. */
export interface Rock {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    readonly isBroken: boolean;
}

/**
 * A field of rocks to break. Once every rock is broken, a new field appears
 * after a moment. Positions are in world units, with the top left corner at
 * 0, 0. The model keeps no beat. How the game sounds as the rocks thin out
 * is up to its views.
 */
export interface RockFieldModel {
    readonly rocks: readonly Rock[];
    readonly rocksLeft: number;
    /** Rocks broken this game. Each rise is a rock broken. */
    readonly rocksBroken: number;
    /** Breaks the rock at this point, if there is one. */
    readonly breakRockAt: (x: number, y: number) => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a field of eight rocks, none of them broken. */
export function createRockFieldModel(): RockFieldModel {
    const rocks: { x: number; y: number; radius: number; isBroken: boolean }[] = [];
    for (let i = 0; i < PLACES.length; i++) {
        rocks.push({ x: PLACES[i].x, y: PLACES[i].y, radius: PLACES[i].radius, isBroken: false });
    }
    let rocksLeft = rocks.length;
    let rocksBroken = 0;
    // How long until a new field appears, once every rock is broken, in ms
    let refillMs = 0;

    const model: RockFieldModel = {
        rocks,
        get rocksLeft() { return rocksLeft; },
        get rocksBroken() { return rocksBroken; },

        breakRockAt(x, y) {
            for (let i = 0; i < rocks.length; i++) {
                const rock = rocks[i];
                if (rock.isBroken) continue;
                if ((x - rock.x) ** 2 + (y - rock.y) ** 2 > rock.radius * rock.radius) continue;
                rock.isBroken = true;
                rocksLeft -= 1;
                rocksBroken += 1;
                if (rocksLeft === 0) refillMs = REFILL_MS;
                return;
            }
        },

        update(deltaMs) {
            if (rocksLeft > 0) return;
            refillMs -= deltaMs;
            if (refillMs > 0) return;
            for (let i = 0; i < rocks.length; i++) rocks[i].isBroken = false;
            rocksLeft = rocks.length;
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where each rock is, and how big. */
const PLACES: readonly { readonly x: number; readonly y: number; readonly radius: number }[] = [
    { x: 250, y: 90, radius: 30 },
    { x: 400, y: 70, radius: 24 },
    { x: 540, y: 120, radius: 34 },
    { x: 300, y: 200, radius: 26 },
    { x: 460, y: 220, radius: 30 },
    { x: 580, y: 280, radius: 24 },
    { x: 220, y: 300, radius: 32 },
    { x: 380, y: 310, radius: 26 },
];
