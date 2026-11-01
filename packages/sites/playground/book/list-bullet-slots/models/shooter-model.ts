import { createSlotList, type Slot, type SlotList } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the ship waits between shots, in ms: a dozen bullets a second. */
const FIRE_MS = 1000 / 12;
/** How long the ship waits between shots while firing rapidly, in ms. */
const RAPID_FIRE_MS = 1000 / 30;
/** How fast a bullet flies, in world units per ms. */
const BULLET_SPEED = 0.4;
/** How long the ship takes to sweep down and up again, in ms. */
const SWEEP_MS = 4000;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A bullet in flight. Positions are in world units, from the top left corner. */
export interface BulletModel {
    readonly x: number;
    readonly y: number;
}

/**
 * A ship that sweeps up and down the left edge, firing bullets to the
 * right. The bullets are kept in a slot list: each new bullet takes the
 * lowest free slot, and keeps it until it leaves the play area.
 */
export interface ShooterModel {
    readonly shipX: number;
    readonly shipY: number;
    readonly bullets: SlotList<BulletModel>;
    /** Whether the ship fires faster than usual, for as long as this is true. */
    isFiringRapidly: boolean;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShooterModelOptions {
    /** The width of the play area, in world units. */
    readonly width: number;
    /** The height of the play area, in world units. */
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a ship at the middle of the left edge, with no bullets yet. */
export function createShooterModel({ width, height }: ShooterModelOptions): ShooterModel {
    const bullets = createSlotList<MutableBullet>();
    let shipY = height / 2;
    let isFiringRapidly = false;
    // How long the ship has flown, and how long since it last fired, in ms
    let flownMs = 0;
    let sinceFiredMs = 0;
    // How far each bullet moves in this update, in world units
    let stepDistance = 0;

    const model: ShooterModel = {
        shipX: SHIP_X,
        get shipY() { return shipY; },
        bullets,
        get isFiringRapidly() { return isFiringRapidly; },
        set isFiringRapidly(value) { isFiringRapidly = value; },

        update(deltaMs) {
            flownMs += deltaMs;
            shipY = height / 2 + Math.sin((flownMs / SWEEP_MS) * Math.PI * 2) * height * 0.35;

            stepDistance = BULLET_SPEED * deltaMs;
            bullets.forEachLive(moveBullet);

            sinceFiredMs += deltaMs;
            const fireEveryMs = isFiringRapidly ? RAPID_FIRE_MS : FIRE_MS;
            while (sinceFiredMs >= fireEveryMs) {
                sinceFiredMs -= fireEveryMs;
                bullets.insert({ x: SHIP_X, y: shipY });
            }
            bullets.update(deltaMs);
        },
    };

    return model;

    function moveBullet(bullet: MutableBullet, slot: Slot<MutableBullet>): void {
        bullet.x += stepDistance;
        if (bullet.x > width) bullets.remove(slot);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface MutableBullet {
    x: number;
    y: number;
}

/** Where the ship flies, in world units from the left edge. */
const SHIP_X = 50;
