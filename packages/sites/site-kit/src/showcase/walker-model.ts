// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// Every length is in metres, every angle in radians, and every heading is
// measured from +x toward +z, as seen from above.

/** Which way the walker walks, along the way they face. */
export type Walking = 'forward' | 'none' | 'back';
/** Which way the walker steps sideways, without turning. */
export type Strafing = 'left' | 'none' | 'right';

/** Something standing on the floor that the walker faces to use, such as a cabinet, or a box the walker can't walk through. */
export interface Stand {
    /** The middle of its footprint, in metres. */
    readonly x: number;
    readonly z: number;
    /** The way its front faces, from +x toward +z. */
    readonly facing: number;
}

/**
 * Someone walking round a 3D scene, seen from above as a circle on the
 * floor, for a first-person view. They walk forward and back, step sideways,
 * turn and look up and down. The walker only moves. After each update, the
 * showcase's model keeps them out of walls and furniture with `pushOutOf`
 * and `keepInside`, and finds what's in reach with `distanceToUse`.
 */
export interface WalkerModel {
    /** Where the walker stands, in metres, and the way they face. */
    readonly x: number;
    readonly z: number;
    readonly heading: number;
    /** How far the walker looks up, in radians, or down for less than 0. */
    readonly pitch: number;
    /** Walking forward or back, along the way they face. */
    walking: Walking;
    /** Stepping sideways, without turning. */
    strafing: Strafing;
    /** Turns the walker on the spot, by `radians`, to the right for more than 0. */
    readonly turnBy: (radians: number) => void;
    /** Tilts the walker's view up by `radians`, or down for less than 0, as far as a neck bends. */
    readonly tiltBy: (radians: number) => void;
    /** Puts the walker at `x`, `z`, facing `heading`, looking ahead as they start. */
    readonly placeAt: (x: number, z: number, heading: number) => void;
    /**
     * Puts the walker square in front of `stand`, `length` from front to back,
     * `distance` from its front, facing it, looking ahead as they start.
     */
    readonly standBefore: (stand: Stand, length: number, distance: number) => void;
    /** Pushes the walker out of the footprint of `stand`, `length` from front to back and `width` across, if they overlap it. */
    readonly pushOutOf: (stand: Stand, length: number, width: number) => void;
    /** Keeps the whole of the walker's circle inside a rectangle on the floor. */
    readonly keepInside: (minX: number, maxX: number, minZ: number, maxZ: number) => void;
    /**
     * Returns how far the walker is from where they'd stand to use `stand`,
     * which is `length` from front to back. That spot is `spotDistance` in
     * front of it. It returns Infinity if they aren't facing it.
     */
    readonly distanceToUse: (stand: Stand, length: number, spotDistance: number) => number;
    /** Walks and steps sideways, as `walking` and `strafing` say, for `deltaMs`. */
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WalkerModelOptions {
    /** The walker's size, as a circle on the floor, in metres. */
    readonly radius: number;
    /** How fast they walk, in metres a second. */
    readonly walkSpeed: number;
    /** How directly they must face a stand to use it, as the cosine of the widest angle. */
    readonly facingCosine: number;
    /** How far they look up as they start, and each time they're placed, in radians. */
    readonly startPitch: number;
    /** How far they can look up or down, in radians. */
    readonly maxPitch: number;
    /** Where they start, and the way they face. */
    readonly x: number;
    readonly z: number;
    readonly heading: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a walker standing still where the options say. */
export function createWalkerModel(options: WalkerModelOptions): WalkerModel {
    const { radius, walkSpeed, facingCosine, startPitch, maxPitch } = options;
    let x = options.x;
    let z = options.z;
    let heading = options.heading;
    let pitch = startPitch;

    const walker: WalkerModel = {
        get x() {
            return x;
        },
        get z() {
            return z;
        },
        get heading() {
            return heading;
        },
        get pitch() {
            return pitch;
        },
        walking: 'none',
        strafing: 'none',

        turnBy(radians) {
            heading += radians;
        },

        tiltBy(radians) {
            pitch = Math.min(maxPitch, Math.max(-maxPitch, pitch + radians));
        },

        placeAt(nextX, nextZ, nextHeading) {
            x = nextX;
            z = nextZ;
            heading = nextHeading;
            pitch = startPitch;
        },

        standBefore(stand, length, distance) {
            const fromMiddle = length / 2 + distance;
            walker.placeAt(stand.x + Math.cos(stand.facing) * fromMiddle, stand.z + Math.sin(stand.facing) * fromMiddle, stand.facing + Math.PI);
        },

        pushOutOf(stand, length, width) {
            // In the stand's own frame, its front faces +u and its side runs along v
            const cos = Math.cos(stand.facing);
            const sin = Math.sin(stand.facing);
            const dx = x - stand.x;
            const dz = z - stand.z;
            const u = dx * cos + dz * sin;
            const v = -dx * sin + dz * cos;
            const nearestU = Math.min(length / 2, Math.max(-length / 2, u));
            const nearestV = Math.min(width / 2, Math.max(-width / 2, v));
            const gapU = u - nearestU;
            const gapV = v - nearestV;
            const gap = Math.hypot(gapU, gapV);
            if (gap >= radius) return;
            let pushU: number;
            let pushV: number;
            if (gap > 0) {
                // Out along the line from the nearest point of the footprint
                const push = (radius - gap) / gap;
                pushU = gapU * push;
                pushV = gapV * push;
            }
            else {
                // The middle is inside the footprint, as after a long step, so out through the nearest face
                const toFrontOrBack = length / 2 - Math.abs(u);
                const toSide = width / 2 - Math.abs(v);
                pushU = toFrontOrBack <= toSide ? (u < 0 ? -1 : 1) * (toFrontOrBack + radius) : 0;
                pushV = toFrontOrBack <= toSide ? 0 : (v < 0 ? -1 : 1) * (toSide + radius);
            }
            x += pushU * cos - pushV * sin;
            z += pushU * sin + pushV * cos;
        },

        keepInside(minX, maxX, minZ, maxZ) {
            x = Math.min(maxX - radius, Math.max(minX + radius, x));
            z = Math.min(maxZ - radius, Math.max(minZ + radius, z));
        },

        distanceToUse(stand, length, spotDistance) {
            const frontX = Math.cos(stand.facing);
            const frontZ = Math.sin(stand.facing);
            // Facing the stand means looking against the way its front faces
            const facing = -(Math.cos(heading) * frontX + Math.sin(heading) * frontZ);
            if (facing <= facingCosine) return Infinity;
            const fromMiddle = length / 2 + spotDistance;
            return Math.hypot(stand.x + frontX * fromMiddle - x, stand.z + frontZ * fromMiddle - z);
        },

        update(deltaMs) {
            const forward = WALK_DIRECTIONS[walker.walking];
            const sideways = STRAFE_DIRECTIONS[walker.strafing];
            if (forward === 0 && sideways === 0) return;
            // Walking forward and sideways at once is no faster than either alone
            const step = (walkSpeed * deltaMs) / 1000 / Math.hypot(forward, sideways);
            // Right of the way the walker faces is a quarter turn on from it
            x += (Math.cos(heading) * forward - Math.sin(heading) * sideways) * step;
            z += (Math.sin(heading) * forward + Math.cos(heading) * sideways) * step;
        },
    };
    return walker;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WALK_DIRECTIONS: Readonly<Record<Walking, number>> = { forward: 1, none: 0, back: -1 };
// Seen from above, with +x to the east, +z points south, so the right of a walker facing east is +z
const STRAFE_DIRECTIONS: Readonly<Record<Strafing, number>> = { left: -1, none: 0, right: 1 };
