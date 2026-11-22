import { CAR_HALF_LENGTH, CAR_HALF_WIDTH, EXPLOSION_MS, MISSILE_MS, MISSILE_RADIUS, WRECKAGE_MS } from '../data';
import { isCarTouchingCar } from './is-car-touching-car';
import type { Track } from './track';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Who fired a missile: you, or a rival, by its index. */
export type Shooter = number;

/** The shooter that stands for you, since the rivals are numbered from 0. */
export const PLAYER_SHOOTER: Shooter = -1;

/**
 * The fight on the track. It holds the missiles in flight, the explosions,
 * and the burning wrecks. Each kind is kept in a pool of a fixed size, so
 * the model doesn't make new objects as they come and go. A view can then keep
 * one set of meshes for each slot. A slot that isn't in use has `isActive`
 * false. A car drives through an explosion unharmed, but a burning wreck is
 * in its way.
 */
export interface BattleModel {
    readonly missiles: readonly Missile[];
    readonly explosions: readonly Explosion[];
    readonly wreckage: readonly Wreckage[];
    /** Fires a missile from just ahead of the nose of a car at this place, heading and speed, if a slot is free. */
    readonly fireMissile: (x: number, z: number, heading: number, speed: number, sample: number, shooter: Shooter) => void;
    /** Blows a missile up where it is, as when it hits a tree. */
    readonly explodeMissile: (index: number) => void;
    /** Takes a missile out of the air without an explosion of its own, as when the car it hits blows up instead. */
    readonly removeMissile: (index: number) => void;
    /** Sets off an explosion at a place. */
    readonly explode: (x: number, z: number) => void;
    /** Leaves a burning wreck at a car's place, near a track sample. */
    readonly leaveWreckage: (x: number, z: number, heading: number, sample: number) => void;
    /** Whether a car at this place and heading touches a burning wreck. */
    readonly isWreckageTouching: (x: number, z: number, heading: number) => boolean;
    /** Whether a wreck lies in a lane, from a distance along the track to `lookAhead` metres past it. */
    readonly isLaneBlocked: (distance: number, offset: number, lookAhead: number) => boolean;
    /** Clears the track, for a new race. */
    readonly clear: () => void;
    /** Moves the missiles on, and ages the explosions and the wrecks. A missile that reaches the wall blows up there. */
    readonly step: (stepMs: number) => void;
}

/** A missile, flying straight along its heading. */
export interface Missile {
    readonly x: number;
    readonly z: number;
    readonly heading: number;
    /** The track sample it is nearest. */
    readonly trackSample: number;
    readonly shooter: Shooter;
    readonly isActive: boolean;
}

/** An explosion, from its flash to its last smoke. It's only for show, and doesn't harm a car. */
export interface Explosion {
    /** A number for each explosion, new each time the slot is used, so a view can tell a new explosion from an old one. */
    readonly serial: number;
    readonly x: number;
    readonly z: number;
    /** How long ago it went off, in milliseconds. */
    readonly ageMs: number;
    readonly isActive: boolean;
}

/** A car's burning wreck, in the way until it burns out. */
export interface Wreckage {
    readonly x: number;
    readonly z: number;
    readonly heading: number;
    /** How much longer it burns, in milliseconds. */
    readonly burnMs: number;
    readonly isActive: boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BattleModelOptions {
    readonly track: Track;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the fight, with the track clear. */
export function createBattleModel(options: BattleModelOptions): BattleModel {
    const { track } = options;
    const missiles = createPool(MISSILE_POOL_SIZE, (): MutableMissile => ({ x: 0, z: 0, heading: 0, trackSample: 0, shooter: 0, speed: 0, ageMs: 0, isActive: false }));
    const explosions = createPool(EXPLOSION_POOL_SIZE, (): MutableExplosion => ({ serial: 0, x: 0, z: 0, ageMs: 0, isActive: false }));
    const wreckage = createPool(WRECKAGE_POOL_SIZE, (): MutableWreckage => ({ x: 0, z: 0, heading: 0, burnMs: 0, distance: 0, offset: 0, isActive: false }));
    // When a pool is full, the next one takes the oldest one's place
    let nextExplosion = 0;
    let nextWreckage = 0;
    let explosionSerial = 0;

    const battle: BattleModel = {
        missiles,
        explosions,
        wreckage,
        fireMissile(x, z, heading, speed, sample, shooter) {
            const missile = findFree(missiles);
            if (missile === undefined) return;
            const cos = Math.cos(heading);
            const sin = Math.sin(heading);
            missile.x = x + cos * LAUNCH_AHEAD;
            missile.z = z + sin * LAUNCH_AHEAD;
            missile.heading = heading;
            missile.trackSample = sample;
            missile.shooter = shooter;
            missile.speed = speed;
            missile.ageMs = 0;
            missile.isActive = true;
        },
        explodeMissile(index) {
            const missile = missiles[index];
            missile.isActive = false;
            battle.explode(missile.x, missile.z);
        },
        removeMissile(index) {
            missiles[index].isActive = false;
        },
        explode(x, z) {
            const explosion = explosions[nextExplosion];
            nextExplosion = (nextExplosion + 1) % explosions.length;
            explosion.serial = ++explosionSerial;
            explosion.x = x;
            explosion.z = z;
            explosion.ageMs = 0;
            explosion.isActive = true;
        },
        leaveWreckage(x, z, heading, sample) {
            const wreck = wreckage[nextWreckage];
            nextWreckage = (nextWreckage + 1) % wreckage.length;
            wreck.x = x;
            wreck.z = z;
            wreck.heading = heading;
            wreck.burnMs = WRECKAGE_MS;
            wreck.distance = track.samples[sample].distance;
            wreck.offset = track.measureOffset(x, z, sample);
            wreck.isActive = true;
        },
        isWreckageTouching(x, z, heading) {
            for (let i = 0; i < wreckage.length; i++) {
                const wreck = wreckage[i];
                if (wreck.isActive && isCarTouchingCar(wreck.x, wreck.z, wreck.heading, x, z, heading)) return true;
            }
            return false;
        },
        isLaneBlocked(distance, offset, lookAhead) {
            // From a car's length behind, so a car already beside a wreck doesn't swerve into it
            const from = distance - CAR_HALF_LENGTH * 2;
            const reach = lookAhead + CAR_HALF_LENGTH * 2;
            for (let i = 0; i < wreckage.length; i++) {
                const wreck = wreckage[i];
                if (!wreck.isActive) continue;
                const ahead = (wreck.distance - from + track.length) % track.length;
                if (ahead < reach && Math.abs(wreck.offset - offset) < CAR_HALF_WIDTH * 2 + LANE_CLEARANCE) return true;
            }
            return false;
        },
        clear() {
            for (let i = 0; i < missiles.length; i++) missiles[i].isActive = false;
            for (let i = 0; i < explosions.length; i++) explosions[i].isActive = false;
            for (let i = 0; i < wreckage.length; i++) wreckage[i].isActive = false;
            nextExplosion = 0;
            nextWreckage = 0;
        },
        step(stepMs) {
            const dt = stepMs / 1000;
            for (let i = 0; i < missiles.length; i++) {
                if (missiles[i].isActive) flyMissile(i, stepMs, dt);
            }
            for (let i = 0; i < explosions.length; i++) {
                const explosion = explosions[i];
                if (!explosion.isActive) continue;
                explosion.ageMs += stepMs;
                if (explosion.ageMs >= EXPLOSION_MS) explosion.isActive = false;
            }
            for (let i = 0; i < wreckage.length; i++) {
                const wreck = wreckage[i];
                if (!wreck.isActive) continue;
                wreck.burnMs -= stepMs;
                if (wreck.burnMs <= 0) wreck.isActive = false;
            }
        },
    };
    return battle;

    /** Moves a missile on. It blows up at the wall, and burns out if it flies its full time without hitting anything. */
    function flyMissile(index: number, stepMs: number, dt: number): void {
        const missile = missiles[index];
        missile.ageMs += stepMs;
        if (missile.ageMs >= MISSILE_MS) {
            missile.isActive = false;
            return;
        }
        missile.x += Math.cos(missile.heading) * missile.speed * dt;
        missile.z += Math.sin(missile.heading) * missile.speed * dt;
        missile.trackSample = track.findNearestSample(missile.x, missile.z, missile.trackSample);
        // A missile that reaches the wall blows up against it
        const offset = track.measureOffset(missile.x, missile.z, missile.trackSample);
        if (Math.abs(offset) > track.findWallOffset(missile.trackSample, offset > 0 ? 1 : -1) - MISSILE_RADIUS) battle.explodeMissile(index);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The pools' sizes, enough for a full field of rivals firing at once. */
const MISSILE_POOL_SIZE = 48;
const EXPLOSION_POOL_SIZE = 16;
const WRECKAGE_POOL_SIZE = 24;
/** How far ahead of a car's middle its missiles start, clear of its nose. */
const LAUNCH_AHEAD = CAR_HALF_LENGTH + 1;
/** The room a car leaves, beside a wreck, as it passes it. */
const LANE_CLEARANCE = 0.8;

interface MutableMissile {
    x: number;
    z: number;
    heading: number;
    trackSample: number;
    shooter: Shooter;
    /** Its speed, in metres per second. */
    speed: number;
    /** How long it has flown, in milliseconds. */
    ageMs: number;
    isActive: boolean;
}

interface MutableExplosion {
    serial: number;
    x: number;
    z: number;
    ageMs: number;
    isActive: boolean;
}

/** A wreck also keeps where it is along the track, and across it, so a rival can see whether it's in its lane. */
interface MutableWreckage {
    x: number;
    z: number;
    heading: number;
    burnMs: number;
    distance: number;
    offset: number;
    isActive: boolean;
}

function createPool<T>(size: number, create: () => T): T[] {
    const pool: T[] = [];
    for (let i = 0; i < size; i++) pool.push(create());
    return pool;
}

function findFree<T extends { readonly isActive: boolean }>(pool: readonly T[]): T | undefined {
    for (let i = 0; i < pool.length; i++) if (!pool[i].isActive) return pool[i];
    return undefined;
}
