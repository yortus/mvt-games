// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** How fast the swing's time runs: stopped, at a quarter speed, in real time, or twice as fast. */
export type Playback = 'paused' | 'slow' | 'normal' | 'fast';

/**
 * Two arms of equal weight, the second shorter and hanging from the end of the
 * first, swinging under gravity. Time reaches the swing only through
 * `update`, in fixed small steps, so it swings the same at any frame rate and
 * any playback speed.
 */
export interface PendulumModel {
    /** Each arm's length, in metres. */
    readonly length1: number;
    readonly length2: number;
    /** Each arm's angle from straight down, in radians. Positive is to the right. */
    readonly angle1: number;
    readonly angle2: number;
    /** Simulated time since this swing began, in seconds. */
    readonly time: number;
    playback: Playback;
    /** Adds one frame's worth of time at the next update, whatever the playback, for stepping while paused. */
    step: () => void;
    /** Starts a new swing, from a new pose, at rest. */
    restart: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Starts a swing from a random pose, both arms raised high. */
export function createPendulumModel(): PendulumModel {
    let angle1: number;
    let angle2: number;
    let speed1: number;
    let speed2: number;
    let time: number;
    let msToRun: number;
    // Each arm's angular acceleration, as `accelerate` last worked it out
    const accel = new Float64Array(2);

    const model: PendulumModel = {
        length1: LENGTH_1,
        length2: LENGTH_2,
        get angle1() { return angle1; },
        get angle2() { return angle2; },
        get time() { return time; },
        playback: 'normal',
        step: () => { msToRun += FRAME_MS; },
        restart,
        update(deltaMs) {
            msToRun += deltaMs * PLAYBACK_RATE[model.playback];
            while (msToRun >= TICK_MS) {
                msToRun -= TICK_MS;
                tick(TICK_MS / 1000);
            }
        },
    };
    restart();
    return model;

    function restart(): void {
        angle1 = Math.PI * (0.6 + 0.35 * Math.random());
        angle2 = Math.PI * (0.5 + 0.5 * Math.random());
        speed1 = speed2 = time = msToRun = 0;
    }

    /** Advances the swing by `dt` seconds, by the midpoint method: each change is measured halfway through the step. */
    function tick(dt: number): void {
        accelerate(angle1, angle2, speed1, speed2);
        const midSpeed1 = speed1 + accel[0] * dt / 2;
        const midSpeed2 = speed2 + accel[1] * dt / 2;
        accelerate(angle1 + speed1 * dt / 2, angle2 + speed2 * dt / 2, midSpeed1, midSpeed2);
        angle1 += midSpeed1 * dt;
        angle2 += midSpeed2 * dt;
        speed1 += accel[0] * dt;
        speed2 += accel[1] * dt;
        time += dt;
    }

    /** Sets `accel` to each arm's angular acceleration: the equations of motion for two arms of equal weight. */
    function accelerate(a1: number, a2: number, s1: number, s2: number): void {
        const d = a1 - a2;
        const below = 3 - Math.cos(2 * d);
        accel[0] = (-3 * G * Math.sin(a1) - G * Math.sin(a1 - 2 * a2)
            - 2 * Math.sin(d) * (s2 * s2 * LENGTH_2 + s1 * s1 * LENGTH_1 * Math.cos(d))) / (LENGTH_1 * below);
        accel[1] = 2 * Math.sin(d) * (2 * s1 * s1 * LENGTH_1 + 2 * G * Math.cos(a1) + s2 * s2 * LENGTH_2 * Math.cos(d)) / (LENGTH_2 * below);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Gravity, in metres per second per second. */
const G = 9.81;
/** Each arm's length, in metres. */
const LENGTH_1 = 1;
const LENGTH_2 = 0.7;
/** The fixed step the swing advances by, however long the frames are. */
const TICK_MS = 1;
/** One frame at 60 frames a second, for `step`. */
const FRAME_MS = 1000 / 60;
const PLAYBACK_RATE: Readonly<Record<Playback, number>> = { paused: 0, slow: 0.25, normal: 1, fast: 2 };
