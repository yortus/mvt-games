import type { ItemKind } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A power-up or bomb dropped by a killed enemy: it pops up, then falls. */
export interface ItemModel {
    readonly kind: ItemKind;
    /** Position in world-units. */
    readonly x: number;
    readonly y: number;
    /** Milliseconds since it was dropped. */
    readonly ageMs: number;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ItemModelOptions {
    readonly kind: ItemKind;
    readonly x: number;
    readonly y: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createItemModel(options: ItemModelOptions): ItemModel {
    const { kind, x } = options;
    let y = options.y;
    let vy = POP_SPEED;
    let ageMs = 0;

    const model: ItemModel = {
        kind,
        x,
        get y() {
            return y;
        },
        get ageMs() {
            return ageMs;
        },

        update(deltaMs) {
            const dt = deltaMs * 0.001;
            ageMs += deltaMs;
            vy = Math.min(FALL_SPEED, vy + GRAVITY * dt);
            y += vy * dt;
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const POP_SPEED = -50;
const GRAVITY = 90;
const FALL_SPEED = 45;
