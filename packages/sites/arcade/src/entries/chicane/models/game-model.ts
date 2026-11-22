import { createRandom } from '@mvtjs/site-kit/random';
import {
    BUMP_SPEED,
    COUNTDOWN_MS,
    FIRE_INTERVAL_MS,
    GANTRY_POST_CLEARANCE,
    GANTRY_POST_SIZE,
    GANTRY_SAMPLE,
    LAPS,
    LAYOUT_SEED,
    MISSILE_RADIUS,
    MISSILE_SPEED,
    PHYSICS_STEP_MS,
    RUNOFF_WIDTH,
    TRACK_POINTS,
    TRACK_SAMPLE_SPACING,
    TRACK_SCALE,
    TRACK_WIDTH,
} from '../data';
import { type BattleModel, createBattleModel, PLAYER_SHOOTER } from './battle-model';
import { type CarModel, createCarModel } from './car-model';
import { isCircleTouchingCar } from './is-circle-touching-car';
import { createLapCounterModel } from './lap-counter-model';
import { createRivalsModel, type RivalsModel } from './rivals-model';
import { createTrack, type Track } from './track';
import { createTreeField, type TreeField } from './tree-field';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Where a race is: the lights counting down, the car racing, or the race over. */
export type GamePhase = 'countdown' | 'racing' | 'finished';

/**
 * A race against the clock, and a fight through a pack of rivals. You drive
 * a few laps of the track after a countdown. The car drives itself up to
 * top speed, and you steer, brake, and fire missiles straight ahead. A
 * missile blows up the first car it hits, which leaves a burning wreck in
 * the way. You can drive through the explosion itself. The rivals fire back
 * at you when you're ahead of them. Hitting a tree, a car, a wall or a wreck
 * too hard blows you up, and costs you the time the wreck burns. The best
 * lap is kept from race to race.
 */
export interface GameModel {
    readonly phase: GamePhase;
    readonly track: Track;
    readonly car: CarModel;
    readonly rivals: RivalsModel;
    readonly battle: BattleModel;
    readonly trees: TreeField;
    /** How long is left of the countdown, in milliseconds. */
    readonly countdownMs: number;
    /** How long the race has run since the start, in milliseconds. It stops at the finish. */
    readonly raceTimeMs: number;
    /** The lap the car is on, from 1, or the last lap once the race is over. */
    readonly lap: number;
    /** How long the lap the car is on has taken so far, in milliseconds. */
    readonly lapTimeMs: number;
    /** The times of the laps finished this race, in milliseconds. */
    readonly lapTimesMs: readonly number[];
    /** The fastest lap of any race this session, in milliseconds, if one has been finished. */
    readonly bestLapMs: number | undefined;
    /** How many laps finished this session set a new best lap. */
    readonly bestLapsSet: number;
    /** How many rivals your missiles have blown up this race. */
    readonly rivalsDestroyed: number;
    /** Whether a rival's missile is closing on you from behind, close enough to dodge. */
    readonly isMissileIncoming: boolean;
    /**
     * How far the driver turns the wheel, from -1, full left lock, to 1, full
     * right. A touch pad turns it part of the way. It moves the car only
     * while it races.
     */
    steering: number;
    isBraking: boolean;
    /** Whether the driver holds Fire. A missile leaves at once, then another each time the gun is ready, while it's held. */
    isFiring: boolean;
    /** Puts the car back on the start line, clears the track, and starts the countdown again. */
    readonly startNewRun: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the game, counting down to its first race. */
export function createGameModel(): GameModel {
    const points = TRACK_POINTS.map((point) => ({ x: point.x * TRACK_SCALE, z: point.z * TRACK_SCALE }));
    const track = createTrack({ points, width: TRACK_WIDTH, wallOffset: TRACK_WIDTH / 2 + RUNOFF_WIDTH, sampleSpacing: TRACK_SAMPLE_SPACING });
    // The start gantry's two posts stand on the grass either side of the start straight, as x and z for each
    const gantry = track.samples[GANTRY_SAMPLE];
    const postReach = TRACK_WIDTH / 2 + GANTRY_POST_CLEARANCE;
    const gantryPosts = [
        gantry.x + gantry.directionZ * postReach, gantry.z - gantry.directionX * postReach,
        gantry.x - gantry.directionZ * postReach, gantry.z + gantry.directionX * postReach,
    ];
    const car = createCarModel({ track });
    const battle = createBattleModel({ track });
    // The trees and the rivals come from one seed, so every session has the same ones
    const random = createRandom({ seed: LAYOUT_SEED });
    const trees = createTreeField({ track, random });
    const rivals = createRivalsModel({ track, random, battle });
    const laps = createLapCounterModel({ sampleCount: track.samples.length, laps: LAPS });

    let phase: GamePhase = 'countdown';
    let countdownMs = COUNTDOWN_MS;
    let rivalsDestroyed = 0;
    let isMissileIncoming = false;
    // How long until the gun can fire again, in milliseconds
    let reloadMs = 0;
    // Time not yet stepped, less than one physics step
    let unsteppedMs = 0;

    const model: GameModel = {
        get phase() {
            return phase;
        },
        track,
        car,
        rivals,
        battle,
        trees,
        get countdownMs() {
            return countdownMs;
        },
        get raceTimeMs() {
            return laps.raceTimeMs;
        },
        get lap() {
            return laps.lap;
        },
        get lapTimeMs() {
            return laps.lapTimeMs;
        },
        get lapTimesMs() {
            return laps.lapTimesMs;
        },
        get bestLapMs() {
            return laps.bestLapMs;
        },
        get bestLapsSet() {
            return laps.bestLapsSet;
        },
        get rivalsDestroyed() {
            return rivalsDestroyed;
        },
        get isMissileIncoming() {
            return isMissileIncoming;
        },
        steering: 0,
        isBraking: false,
        isFiring: false,
        startNewRun() {
            car.placeOnStartLine();
            rivals.placeOnGrid();
            battle.clear();
            phase = 'countdown';
            countdownMs = COUNTDOWN_MS;
            laps.startNewRace();
            rivalsDestroyed = 0;
            isMissileIncoming = false;
            reloadMs = 0;
            unsteppedMs = 0;
        },
        update(deltaMs) {
            unsteppedMs += deltaMs;
            while (unsteppedMs >= PHYSICS_STEP_MS) {
                unsteppedMs -= PHYSICS_STEP_MS;
                step();
            }
        },
    };
    return model;

    function step(): void {
        if (phase === 'countdown') {
            countdownMs -= PHYSICS_STEP_MS;
            if (countdownMs <= 0) {
                countdownMs = 0;
                phase = 'racing';
            }
            return;
        }
        // While racing, the engine always drives the car. Once the race is
        // over, the driver lets go and brakes the car to a stop
        const isRacing = phase === 'racing';
        car.steering = isRacing ? model.steering : 0;
        car.isAccelerating = isRacing;
        car.isBraking = isRacing ? model.isBraking : car.speed > 0.5;
        const sampleBefore = car.trackSample;
        const wrecksBefore = car.wrecks;
        car.step(PHYSICS_STEP_MS);
        // A wall can wreck the car inside its own step, and that wreck blows up like any other
        if (car.wrecks > wrecksBefore) blowUpWreck(car.x, car.z, car.heading, car.trackSample);
        rivals.step(PHYSICS_STEP_MS, car, isRacing);
        fire(isRacing);
        battle.step(PHYSICS_STEP_MS);
        hitWithMissiles();
        collideCar();
        collideRivals();
        isMissileIncoming = findIncomingMissile();
        if (!isRacing) return;
        laps.step(PHYSICS_STEP_MS, sampleBefore, car.trackSample);
        if (laps.isFinished) phase = 'finished';
    }

    /** Fires a missile while the driver holds Fire and the gun is ready. */
    function fire(isRacing: boolean): void {
        reloadMs = Math.max(0, reloadMs - PHYSICS_STEP_MS);
        if (!isRacing || !model.isFiring || reloadMs > 0 || car.isWrecked) return;
        battle.fireMissile(car.x, car.z, car.heading, Math.max(0, car.speed) + MISSILE_SPEED, car.trackSample, PLAYER_SHOOTER);
        reloadMs = FIRE_INTERVAL_MS;
    }

    /**
     * Checks each missile against the cars and the trees. A missile that
     * hits a car blows the car up, and one that hits a tree blows up there.
     * A missile never hits the car that fired it, and passes through a car
     * that has just come back on the track.
     */
    function hitWithMissiles(): void {
        const { missiles } = battle;
        for (let m = 0; m < missiles.length; m++) {
            const missile = missiles[m];
            if (!missile.isActive) continue;
            if (missile.shooter !== PLAYER_SHOOTER && !car.isWrecked && car.shieldMs === 0
                && isCircleTouchingCar(missile.x, missile.z, MISSILE_RADIUS, car.x, car.z, car.heading)) {
                battle.removeMissile(m);
                wreckCar();
                continue;
            }
            const rival = findRivalHitBy(missile.x, missile.z, missile.shooter);
            if (rival >= 0) {
                battle.removeMissile(m);
                wreckRival(rival);
                if (missile.shooter === PLAYER_SHOOTER) rivalsDestroyed++;
                continue;
            }
            if (trees.isTreeWithin(missile.x, missile.z, MISSILE_RADIUS, missile.trackSample)) battle.explodeMissile(m);
        }
    }

    /** The index of a rival a missile at this place hits, or -1 if it hits none. */
    function findRivalHitBy(x: number, z: number, shooter: number): number {
        const { cars } = rivals;
        for (let i = 0; i < cars.length; i++) {
            const rival = cars[i];
            if (i === shooter || rival.isWrecked || rival.shieldMs > 0) continue;
            if (isCircleTouchingCar(x, z, MISSILE_RADIUS, rival.x, rival.z, rival.heading)) return i;
        }
        return -1;
    }

    /**
     * Wrecks your car if it hits a rival, a tree, a post of the gantry or a
     * wreck going faster than a bump. A rival it hits that hard is wrecked
     * with it. A slower touch puts it back where it was: stopped, against
     * something standing still, or moving on at the rival's speed. A car that has just come back on the
     * track drives through all of them.
     */
    function collideCar(): void {
        if (car.isWrecked || car.shieldMs > 0) return;
        // Once the race is over, your car brakes to a stop on the racing line, and the rivals drive through it
        const other = phase === 'racing' ? rivals.findCarTouching(car.x, car.z, car.heading) : -1;
        if (other >= 0) {
            const rival = rivals.cars[other];
            if (Math.abs(car.speed - rival.speed) > BUMP_SPEED) {
                wreckCar();
                wreckRival(other);
            }
            else car.bump(rival.speed);
            return;
        }
        if (!isInTheWayAt(car.x, car.z)) return;
        // Already in the way where it was a step ago, as when its shield runs out over a wreck. It drives on until
        // it's clear, rather than being held there, or blown up again
        if (isInTheWayAt(car.previousX, car.previousZ)) return;
        if (Math.abs(car.speed) > BUMP_SPEED) wreckCar();
        else car.bump(0);
    }

    /** Checks whether your car, at a point, touches a tree, a post of the gantry or a wreck. */
    function isInTheWayAt(x: number, z: number): boolean {
        return trees.findTreeTouching(x, z, car.heading, car.trackSample) >= 0
            || isCircleTouchingCar(gantryPosts[0], gantryPosts[1], GANTRY_POST_RADIUS, x, z, car.heading)
            || isCircleTouchingCar(gantryPosts[2], gantryPosts[3], GANTRY_POST_RADIUS, x, z, car.heading)
            || battle.isWreckageTouching(x, z, car.heading);
    }

    /** Wrecks any rival that drives into a wreck, unless it has just rejoined the track. */
    function collideRivals(): void {
        const { cars } = rivals;
        for (let i = 0; i < cars.length; i++) {
            const rival = cars[i];
            if (rival.isWrecked || rival.shieldMs > 0) continue;
            if (battle.isWreckageTouching(rival.x, rival.z, rival.heading)) wreckRival(i);
        }
    }

    function wreckCar(): void {
        car.wreck();
        blowUpWreck(car.x, car.z, car.heading, car.trackSample);
    }

    function wreckRival(index: number): void {
        const rival = rivals.cars[index];
        rivals.wreck(index);
        blowUpWreck(rival.x, rival.z, rival.heading, rival.trackSample);
    }

    /** A wrecked car blows up, leaving its burning wreck where it was. */
    function blowUpWreck(x: number, z: number, heading: number, sample: number): void {
        battle.leaveWreckage(x, z, heading, sample);
        battle.explode(x, z);
    }

    /** Whether a rival's missile is behind your car, heading your way, and close. */
    function findIncomingMissile(): boolean {
        if (car.isWrecked) return false;
        const { missiles } = battle;
        const cos = Math.cos(car.heading);
        const sin = Math.sin(car.heading);
        for (let i = 0; i < missiles.length; i++) {
            const missile = missiles[i];
            if (!missile.isActive || missile.shooter === PLAYER_SHOOTER) continue;
            const dx = missile.x - car.x;
            const dz = missile.z - car.z;
            const ahead = dx * cos + dz * sin;
            const aside = -dx * sin + dz * cos;
            if (ahead < 0 && ahead > -WARNING_DISTANCE && Math.abs(aside) < WARNING_WIDTH) return true;
        }
        return false;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A gantry post's reach, for collisions: the circle through its square's corners. */
const GANTRY_POST_RADIUS = GANTRY_POST_SIZE * Math.SQRT1_2;

/** How far behind your car a rival's missile is when you're warned of it, and how far to either side. */
const WARNING_DISTANCE = 90;
const WARNING_WIDTH = 8;
