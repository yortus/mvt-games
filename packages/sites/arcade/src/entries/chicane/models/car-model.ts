import {
    ACCELERATION,
    BRAKING,
    CAR_HALF_WIDTH,
    FULL_TURN_SPEED,
    GRASS_DRAG,
    GRASS_MAX_SPEED,
    GRIP,
    MAX_REVERSE_SPEED,
    MAX_SPEED,
    RESPAWN_SPEED,
    ROLLING_DRAG,
    SHIELD_MS,
    STEERING_SPEED,
    TOP_SPEED_TURN_FRACTION,
    TURN_RATE,
    WALL_BOUNCE,
    WALL_CRASH_SPEED,
    WRECK_MS,
} from '../data';
import type { Track } from './track';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The car, driven on the ground. Its position is in metres, and its heading
 * is the angle of its nose from the +x axis toward +z, in radians. The
 * driver's controls are held as state, and each fixed step of `update`
 * reads them.
 */
export interface CarModel {
    readonly x: number;
    readonly z: number;
    readonly heading: number;
    /** Its speed along its heading, in metres per second, negative in reverse. */
    readonly speed: number;
    /** How far the steering is turned, from -1 at full left lock to 1 at full right. */
    readonly steeringLock: number;
    /** How far it has rolled, forward minus backward, which turns its wheels. */
    readonly odometer: number;
    /** Whether any part of it is off the asphalt, so the grass slows it. */
    readonly isOnGrass: boolean;
    /** The track sample it is nearest. */
    readonly trackSample: number;
    /** Whether it's a burning wreck, waiting to come back on the track. */
    readonly isWrecked: boolean;
    /** How many times it has been wrecked, by a wall, a tree, a rival, a missile or what a fight leaves on the track. */
    readonly wrecks: number;
    /** How much longer it drives through things after coming back on the track, in milliseconds. */
    readonly shieldMs: number;
    /** Where it was a step ago, before the last step's move, where a bump puts it back. */
    readonly previousX: number;
    readonly previousZ: number;
    /**
     * How far the driver turns the wheel, from -1, full left lock, to 1,
     * full right. Each step, the steering moves toward it at the steering's
     * own speed.
     */
    steering: number;
    /** Whether the engine drives it. While racing it always does. Once the race is over, it doesn't. */
    isAccelerating: boolean;
    isBraking: boolean;
    /** Puts it back on the start line at a standstill, heading down the straight, with the controls let go. */
    readonly placeOnStartLine: () => void;
    /** Blows it up where it is. After a while it comes back on the track, nearby. */
    readonly wreck: () => void;
    /**
     * Puts it back where it was a step ago, moving forward at `speed`, for a
     * touch too slow to wreck it. Against something standing still, the
     * speed is 0, which stops it dead. Against a rival, it's the rival's
     * speed, so the two don't close on each other again at the next step.
     */
    readonly bump: (speed: number) => void;
    /** Advances it one fixed physics step. */
    readonly step: (stepMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CarModelOptions {
    readonly track: Track;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the car, on the start line. */
export function createCarModel(options: CarModelOptions): CarModel {
    const { track } = options;
    const halfWidth = track.width / 2;

    let x = 0;
    let z = 0;
    let heading = 0;
    // Its velocity, along its heading and sideways to it (toward its right)
    let forwardSpeed = 0;
    let sidewaysSpeed = 0;
    let steeringLock = 0;
    let odometer = 0;
    let isOnGrass = false;
    let trackSample = 0;
    let isWrecked = false;
    let wreckedMs = 0;
    let wrecks = 0;
    let shieldMs = 0;
    // Where it was before the last step's move, for a bump
    let previousX = 0;
    let previousZ = 0;

    const car: CarModel = {
        get x() {
            return x;
        },
        get z() {
            return z;
        },
        get heading() {
            return heading;
        },
        get speed() {
            return forwardSpeed;
        },
        get steeringLock() {
            return steeringLock;
        },
        get odometer() {
            return odometer;
        },
        get isOnGrass() {
            return isOnGrass;
        },
        get trackSample() {
            return trackSample;
        },
        get isWrecked() {
            return isWrecked;
        },
        get wrecks() {
            return wrecks;
        },
        get shieldMs() {
            return shieldMs;
        },
        get previousX() {
            return previousX;
        },
        get previousZ() {
            return previousZ;
        },
        steering: 0,
        isAccelerating: false,
        isBraking: false,
        placeOnStartLine() {
            const start = track.samples[0];
            x = start.x;
            z = start.z;
            heading = Math.atan2(start.directionZ, start.directionX);
            forwardSpeed = 0;
            sidewaysSpeed = 0;
            steeringLock = 0;
            odometer = 0;
            isOnGrass = false;
            trackSample = 0;
            isWrecked = false;
            wreckedMs = 0;
            wrecks = 0;
            shieldMs = 0;
            previousX = x;
            previousZ = z;
            car.steering = 0;
            car.isAccelerating = false;
            car.isBraking = false;
        },
        wreck() {
            isWrecked = true;
            wreckedMs = WRECK_MS;
            forwardSpeed = 0;
            sidewaysSpeed = 0;
            wrecks++;
        },
        bump(speed) {
            x = previousX;
            z = previousZ;
            forwardSpeed = speed;
            sidewaysSpeed = 0;
        },
        step(stepMs) {
            if (isWrecked) {
                wreckedMs -= stepMs;
                if (wreckedMs <= 0) comeBackOnTrack();
                return;
            }
            shieldMs = Math.max(0, shieldMs - stepMs);
            const dt = stepMs / 1000;
            turnSteeringWheel(dt);
            driveWheels(dt);
            turnBody(dt);
            move(dt);
            keepWithinWalls();
        },
    };
    car.placeOnStartLine();
    return car;

    /** Moves the steering toward the lock the driver holds, at the steering's own speed. */
    function turnSteeringWheel(dt: number): void {
        const target = Math.max(-1, Math.min(1, car.steering));
        const reach = STEERING_SPEED * dt;
        steeringLock += Math.max(-reach, Math.min(reach, target - steeringLock));
    }

    /** Applies the throttle, the brakes, the drag, and the sideways grip, to the car's speed. */
    function driveWheels(dt: number): void {
        const topSpeed = isOnGrass ? GRASS_MAX_SPEED : MAX_SPEED;
        const isPowered = car.isAccelerating && !car.isBraking;
        if (isPowered) {
            // It gains less and less as it nears top speed, so it eases into
            // it rather than hitting it, and never passes it under power
            const share = forwardSpeed / topSpeed;
            forwardSpeed += ACCELERATION * dt * Math.max(0, 1 - share * share);
        }
        else if (car.isBraking) {
            // Braking at a standstill backs it up
            forwardSpeed -= (forwardSpeed > 0 ? BRAKING : ACCELERATION) * dt;
            forwardSpeed = Math.max(forwardSpeed, -MAX_REVERSE_SPEED);
        }
        // Under power on asphalt, the engine has already allowed for the drag, so it reaches its top speed
        const drag = isOnGrass ? GRASS_DRAG : isPowered ? 0 : ROLLING_DRAG;
        forwardSpeed -= forwardSpeed * drag * dt;
        // The grass slows a car going faster than it allows, steadily, not at once
        if (isOnGrass && forwardSpeed > GRASS_MAX_SPEED) forwardSpeed -= (forwardSpeed - GRASS_MAX_SPEED) * 2 * dt;
        sidewaysSpeed *= Math.exp(-GRIP * dt);
    }

    /**
     * Turns the car by the steering lock. It turns less slowly than briskly,
     * and less at top speed, and backwards in reverse. Its velocity stays
     * where it was as the body turns, so part of it becomes a slide, which
     * the grip then wears away.
     */
    function turnBody(dt: number): void {
        const speed = Math.abs(forwardSpeed);
        const pickUp = Math.min(1, speed / FULL_TURN_SPEED);
        const fade = 1 - (1 - TOP_SPEED_TURN_FRACTION) * Math.min(1, speed / MAX_SPEED);
        const turn = steeringLock * TURN_RATE * pickUp * fade * Math.sign(forwardSpeed) * dt;
        if (turn === 0) return;
        // The velocity in world terms, before the turn
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);
        const vx = cos * forwardSpeed - sin * sidewaysSpeed;
        const vz = sin * forwardSpeed + cos * sidewaysSpeed;
        heading = wrapAngle(heading + turn);
        // The same velocity, measured against the new heading
        const newCos = Math.cos(heading);
        const newSin = Math.sin(heading);
        forwardSpeed = vx * newCos + vz * newSin;
        sidewaysSpeed = -vx * newSin + vz * newCos;
    }

    /** Puts the wreck back on the centre line where it was, heading the way the track runs, rolling, and shielded for a while. */
    function comeBackOnTrack(): void {
        const sample = track.samples[trackSample];
        x = sample.x;
        z = sample.z;
        heading = Math.atan2(sample.directionZ, sample.directionX);
        forwardSpeed = RESPAWN_SPEED;
        sidewaysSpeed = 0;
        steeringLock = 0;
        isOnGrass = false;
        isWrecked = false;
        shieldMs = SHIELD_MS;
    }

    function move(dt: number): void {
        previousX = x;
        previousZ = z;
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);
        x += (cos * forwardSpeed - sin * sidewaysSpeed) * dt;
        z += (sin * forwardSpeed + cos * sidewaysSpeed) * dt;
        odometer += forwardSpeed * dt;
        trackSample = track.findNearestSample(x, z, trackSample);
        isOnGrass = Math.abs(offsetFromCentre()) > halfWidth - CAR_HALF_WIDTH;
    }

    /** Stops the car at the wall that runs round the grass. It bounces back a little, or blows up if it hit hard. */
    function keepWithinWalls(): void {
        const offset = offsetFromCentre();
        const limit = track.findWallOffset(trackSample, offset > 0 ? 1 : -1) - CAR_HALF_WIDTH;
        if (Math.abs(offset) <= limit) return;
        const sample = track.samples[trackSample];
        // The wall's normal, pointing back toward the track. The track's left
        // is (dz, -dx), so a car off to the left is pushed the other way
        const side = Math.sign(offset);
        const normalX = -sample.directionZ * side;
        const normalZ = sample.directionX * side;
        // Back onto the wall's line
        const over = Math.abs(offset) - limit;
        x += normalX * over;
        z += normalZ * over;
        // Reverse the part of the velocity that carried it into the wall, and soften it
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);
        let vx = cos * forwardSpeed - sin * sidewaysSpeed;
        let vz = sin * forwardSpeed + cos * sidewaysSpeed;
        const into = vx * normalX + vz * normalZ;
        if (into < -WALL_CRASH_SPEED && shieldMs === 0) {
            car.wreck();
            return;
        }
        if (into < 0) {
            vx -= (1 + WALL_BOUNCE) * into * normalX;
            vz -= (1 + WALL_BOUNCE) * into * normalZ;
            forwardSpeed = vx * cos + vz * sin;
            sidewaysSpeed = -vx * sin + vz * cos;
        }
    }

    /** How far the car is from the centre line, positive to the left of the way the track runs. */
    function offsetFromCentre(): number {
        return track.measureOffset(x, z, trackSample);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** An angle brought into -pi to pi, so it never grows without bound. */
function wrapAngle(angle: number): number {
    if (angle > Math.PI) return angle - Math.PI * 2;
    if (angle < -Math.PI) return angle + Math.PI * 2;
    return angle;
}
