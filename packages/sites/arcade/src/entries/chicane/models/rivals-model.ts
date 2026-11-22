import type { Random } from '@mvtjs/site-kit/random';
import {
    CAR_HALF_WIDTH,
    MISSILE_SPEED,
    RIVAL_COUNT,
    RIVAL_FIRE_AIM,
    RIVAL_FIRE_MAX_RANGE,
    RIVAL_FIRE_MAX_WAIT_MS,
    RIVAL_FIRE_MIN_RANGE,
    RIVAL_FIRE_MIN_WAIT_MS,
    RIVAL_FOLLOW_GAP,
    RIVAL_LANE_CHANGE_SPEED,
    RIVAL_LANES,
    RIVAL_LOOK_AHEAD,
    RIVAL_MAX_SPEED,
    RIVAL_MIN_SPEED,
    RIVAL_RESPAWN_BEHIND,
    RIVAL_RESPAWN_MS,
    RIVAL_SHIELD_MS,
} from '../data';
import type { BattleModel } from './battle-model';
import { isCarTouchingCar } from './is-car-touching-car';
import type { Track, TrackPlace } from './track';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The rival cars on the track. Each keeps to a lane at its own speed, and
 * slows behind a slower car in its lane. It moves across to another lane to
 * get round a wreck ahead. It fires a missile at you when you're
 * in front of it, lined up with its nose.
 */
export interface RivalsModel {
    readonly cars: readonly RivalCar[];
    /** The index of a rival that touches a car at this place and heading, or -1. A rival that's wrecked, or has just rejoined the track, doesn't count. */
    readonly findCarTouching: (x: number, z: number, heading: number) => number;
    /** Wrecks a rival. It's gone for a while, then rejoins the track behind you, out of sight. */
    readonly wreck: (index: number) => void;
    /** Puts every rival back where it starts a race. */
    readonly placeOnGrid: () => void;
    /** Advances the rivals one fixed physics step. They fire at the target only if `canFire` is true. */
    readonly step: (stepMs: number, target: RivalTarget, canFire: boolean) => void;
}

/** A rival car. */
export interface RivalCar {
    readonly x: number;
    readonly z: number;
    readonly heading: number;
    /** Its speed, in metres per second. */
    readonly speed: number;
    /** How far it has rolled, which turns its wheels. */
    readonly odometer: number;
    /** The track sample it is nearest. */
    readonly trackSample: number;
    readonly isWrecked: boolean;
    /** How much longer it drives through things after rejoining the track, in milliseconds. */
    readonly shieldMs: number;
}

/** The car the rivals fire at, which is yours. */
export interface RivalTarget {
    readonly x: number;
    readonly z: number;
    readonly trackSample: number;
    readonly isWrecked: boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RivalsModelOptions {
    readonly track: Track;
    /** Each rival's lane, speed, and how long it waits between shots. The same seed gives the same rivals. */
    readonly random: Random;
    /** The fight their missiles join, and the wrecks they steer round. */
    readonly battle: BattleModel;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the rivals, spread round the track ahead of the start line. */
export function createRivalsModel(options: RivalsModelOptions): RivalsModel {
    const { track, random, battle } = options;
    const cars: MutableRivalCar[] = [];
    for (let i = 0; i < RIVAL_COUNT; i++) {
        const lane = RIVAL_LANES[i % RIVAL_LANES.length];
        cars.push({
            x: 0,
            z: 0,
            heading: 0,
            speed: 0,
            odometer: 0,
            trackSample: 0,
            isWrecked: false,
            shieldMs: 0,
            startLane: lane,
            offset: lane,
            targetOffset: lane,
            cruiseSpeed: random.between(RIVAL_MIN_SPEED, RIVAL_MAX_SPEED),
            distance: 0,
            wreckedMs: 0,
            fireWaitMs: 0,
        });
    }
    const place: TrackPlace = { x: 0, z: 0, heading: 0 };
    // The cars in order of how far round the track each was as the step began, nearest the line first,
    // with those distances, and where each car is in the order. A car looks for one to follow only among
    // the few next to it in this order, not among every car
    const order: number[] = [];
    const orderDistance: number[] = [];
    const rankOf: number[] = [];
    for (let i = 0; i < cars.length; i++) {
        order.push(i);
        orderDistance.push(0);
        rankOf.push(i);
    }
    // How far a car can move in the step under way, so how far one just behind another can have passed it
    let stepReach = 0;
    // The leader `findLeader` has found so far, and how far ahead it is
    let leader: MutableRivalCar | undefined;
    let nearest = 0;

    const rivals: RivalsModel = {
        cars,
        findCarTouching(x, z, heading) {
            for (let i = 0; i < cars.length; i++) {
                const car = cars[i];
                // A rival that has just rejoined the track drives through you, as it does through everything
                if (!car.isWrecked && car.shieldMs <= 0 && isCarTouchingCar(car.x, car.z, car.heading, x, z, heading)) return i;
            }
            return -1;
        },
        wreck(index) {
            const car = cars[index];
            car.isWrecked = true;
            car.wreckedMs = RIVAL_RESPAWN_MS;
        },
        placeOnGrid() {
            // Spread round the lap, clear of the start line ahead and behind, so none runs into you on the grid at once
            for (let i = 0; i < cars.length; i++) {
                const car = cars[i];
                car.distance = FIRST_CAR_AHEAD + (i * (track.length - FIRST_CAR_AHEAD - LAST_CAR_BEHIND)) / (cars.length - 1);
                car.offset = car.startLane;
                car.targetOffset = car.startLane;
                car.speed = car.cruiseSpeed;
                car.odometer = 0;
                car.isWrecked = false;
                car.wreckedMs = 0;
                car.shieldMs = 0;
                car.fireWaitMs = random.between(RIVAL_FIRE_MIN_WAIT_MS, RIVAL_FIRE_MAX_WAIT_MS);
                moveTo(car, 0);
            }
            sortCars();
        },
        step(stepMs, target, canFire) {
            const dt = stepMs / 1000;
            stepReach = RIVAL_MAX_SPEED * dt;
            sortCars();
            for (let i = 0; i < cars.length; i++) {
                const car = cars[i];
                if (car.isWrecked) {
                    car.wreckedMs -= stepMs;
                    if (car.wreckedMs <= 0) rejoinBehind(i, target);
                    continue;
                }
                car.shieldMs = Math.max(0, car.shieldMs - stepMs);
                steerRoundHazards(car);
                // Slow to the speed of a car close ahead in the lane, or speed back up to cruising
                const leader = findLeader(i);
                const cruise = leader === undefined ? car.cruiseSpeed : Math.min(car.cruiseSpeed, leader.speed);
                car.speed += Math.max(-SPEED_CHANGE * dt, Math.min(SPEED_CHANGE * dt, cruise - car.speed));
                car.distance = (car.distance + car.speed * dt) % track.length;
                car.odometer += car.speed * dt;
                // Across toward the lane it's heading for, at a steady rate
                const across = Math.max(-RIVAL_LANE_CHANGE_SPEED * dt, Math.min(RIVAL_LANE_CHANGE_SPEED * dt, car.targetOffset - car.offset));
                car.offset += across;
                moveTo(car, dt === 0 ? 0 : across / dt);
                car.fireWaitMs -= stepMs;
                if (canFire && car.fireWaitMs <= 0) fireIfLinedUp(car, i, target);
            }
        },
    };
    rivals.placeOnGrid();
    return rivals;

    /** Puts a car on the track at its distance and offset. It noses toward the side it's moving to, by how fast it moves across. */
    function moveTo(car: MutableRivalCar, acrossSpeed: number): void {
        track.locate(car.distance, car.offset, place);
        car.x = place.x;
        car.z = place.z;
        // Moving to the left, toward a bigger offset, turns its nose from the track's heading toward -z of it
        car.heading = place.heading - Math.atan2(acrossSpeed, Math.max(1, car.speed));
        // A rival never leaves the asphalt, so its sample comes from how far along it is, without a search
        car.trackSample = Math.min(track.samples.length - 1, Math.floor(car.distance / (track.length / track.samples.length)));
    }

    /** If a wreck lies ahead in the lane it's heading for, picks the nearest lane that's clear, if one is. */
    function steerRoundHazards(car: MutableRivalCar): void {
        if (!battle.isLaneBlocked(car.distance, car.targetOffset, RIVAL_LOOK_AHEAD)) return;
        let best = car.targetOffset;
        let bestMove = Infinity;
        for (let i = 0; i < RIVAL_LANES.length; i++) {
            const lane = RIVAL_LANES[i];
            const move = Math.abs(lane - car.offset);
            if (move < bestMove && lane !== car.targetOffset && !battle.isLaneBlocked(car.distance, lane, RIVAL_LOOK_AHEAD)) {
                best = lane;
                bestMove = move;
            }
        }
        car.targetOffset = best;
    }

    /** Brings a wreck back on the track well behind you, in a clear lane, and shielded for a moment. */
    function rejoinBehind(index: number, target: RivalTarget): void {
        const car = cars[index];
        car.isWrecked = false;
        car.shieldMs = RIVAL_SHIELD_MS;
        car.distance = (track.samples[target.trackSample].distance - RIVAL_RESPAWN_BEHIND + track.length) % track.length;
        car.offset = car.startLane;
        car.targetOffset = car.startLane;
        steerRoundHazards(car);
        car.offset = car.targetOffset;
        car.speed = car.cruiseSpeed;
        car.fireWaitMs = random.between(RIVAL_FIRE_MIN_WAIT_MS, RIVAL_FIRE_MAX_WAIT_MS);
        moveTo(car, 0);
        // It jumped back along the track, so it takes its new place in the order now, not at the next step
        resortCar(index);
    }

    /** Fires a missile at the target, if it's in range ahead and lined up with the car's nose. */
    function fireIfLinedUp(car: MutableRivalCar, index: number, target: RivalTarget): void {
        if (target.isWrecked) return;
        const dx = target.x - car.x;
        const dz = target.z - car.z;
        const cos = Math.cos(car.heading);
        const sin = Math.sin(car.heading);
        const ahead = dx * cos + dz * sin;
        const aside = -dx * sin + dz * cos;
        if (ahead < RIVAL_FIRE_MIN_RANGE || ahead > RIVAL_FIRE_MAX_RANGE || Math.abs(aside) > RIVAL_FIRE_AIM) return;
        battle.fireMissile(car.x, car.z, car.heading, car.speed + MISSILE_SPEED, car.trackSample, index);
        car.fireWaitMs = random.between(RIVAL_FIRE_MIN_WAIT_MS, RIVAL_FIRE_MAX_WAIT_MS);
    }

    /**
     * The nearest car ahead in the same lane within the following gap, if
     * there is one. It looks only at the cars next to this one in the order
     * of the step's start. Ahead, it stops at the first that was already the
     * following gap away, since cars only move forward, so none further on
     * can have closed in. Behind, it looks as far as a car can have come
     * this step, in case one has passed this one already. This car hasn't
     * moved since the step began, as it looks before it moves.
     */
    function findLeader(index: number): MutableRivalCar | undefined {
        const car = cars[index];
        const count = order.length;
        const rank = rankOf[index];
        const from = orderDistance[rank];
        leader = undefined;
        nearest = RIVAL_FOLLOW_GAP;
        for (let k = 1; k < count; k++) {
            const o = (rank + k) % count;
            let ahead = orderDistance[o] - from;
            if (ahead < 0) ahead += track.length;
            if (ahead >= RIVAL_FOLLOW_GAP) break;
            considerLeader(car, order[o]);
        }
        for (let k = 1; k < count; k++) {
            const o = (rank - k + count) % count;
            let behind = from - orderDistance[o];
            if (behind < 0) behind += track.length;
            if (behind > stepReach) break;
            considerLeader(car, order[o]);
        }
        return leader;
    }

    /** Keeps car `index` as the leader `findLeader` is looking for, if it's in `car`'s lane, ahead, and nearer than any so far. */
    function considerLeader(car: MutableRivalCar, index: number): void {
        const other = cars[index];
        if (other === car || other.isWrecked || Math.abs(other.offset - car.offset) > SAME_LANE) return;
        const gap = (other.distance - car.distance + track.length) % track.length;
        if (gap < nearest) {
            nearest = gap;
            leader = other;
        }
    }

    /**
     * Puts the cars in order of how far round the track they are, with those
     * distances. They were in order at the last step, and barely move in one,
     * so an insertion sort has little to do. A car crossing the line moves
     * from the end of the order to the start.
     */
    function sortCars(): void {
        const count = order.length;
        for (let k = 0; k < count; k++) orderDistance[k] = cars[order[k]].distance;
        for (let k = 1; k < count; k++) {
            const index = order[k];
            const distance = orderDistance[k];
            let j = k - 1;
            while (j >= 0 && orderDistance[j] > distance) {
                order[j + 1] = order[j];
                orderDistance[j + 1] = orderDistance[j];
                j--;
            }
            order[j + 1] = index;
            orderDistance[j + 1] = distance;
        }
        for (let k = 0; k < count; k++) rankOf[order[k]] = k;
    }

    /** Moves car `index` to its place in the order, by its distance now, past the cars around it. */
    function resortCar(index: number): void {
        let k = rankOf[index];
        const distance = cars[index].distance;
        orderDistance[k] = distance;
        while (k > 0 && orderDistance[k - 1] > distance) {
            swapRanks(k, k - 1);
            k--;
        }
        while (k < order.length - 1 && orderDistance[k + 1] < distance) {
            swapRanks(k, k + 1);
            k++;
        }
    }

    function swapRanks(a: number, b: number): void {
        const index = order[a];
        const distance = orderDistance[a];
        order[a] = order[b];
        orderDistance[a] = orderDistance[b];
        order[b] = index;
        orderDistance[b] = distance;
        rankOf[order[a]] = a;
        rankOf[order[b]] = b;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far along the track the first car starts, and how far behind the start line the last one does. */
const FIRST_CAR_AHEAD = 120;
const LAST_CAR_BEHIND = 320;
/** How quickly a car speeds up or slows down, in metres per second per second. */
const SPEED_CHANGE = 20;
/**
 * How close across the track two cars can be and still count as in one
 * lane. A car changing lanes is between two of them, so lanes are measured
 * by this gap, a car's width and a little more, not by which lane it set
 * out in.
 */
const SAME_LANE = CAR_HALF_WIDTH * 2 + 0.6;

/** A rival as the model changes it. */
interface MutableRivalCar {
    x: number;
    z: number;
    heading: number;
    speed: number;
    odometer: number;
    trackSample: number;
    isWrecked: boolean;
    shieldMs: number;
    /** The lane it starts a race in, and rejoins the track in after a wreck, if it's clear. */
    readonly startLane: number;
    /** How far it is from the centre line, positive to the left. */
    offset: number;
    /** The lane it's moving to, or keeping to. */
    targetOffset: number;
    readonly cruiseSpeed: number;
    /** How far along the track it is. */
    distance: number;
    wreckedMs: number;
    /** How much longer it waits before it can fire again, in milliseconds. */
    fireWaitMs: number;
}
