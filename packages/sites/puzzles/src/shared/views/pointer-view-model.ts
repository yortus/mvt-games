import { createSequence, type Sequence, type StepDef, watch } from '@mvtjs/utils';
import type { Demo } from '../models';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The show a walkthrough's arrow puts on, over and over, for the demo: it
 * comes in, makes the demo's touches, lingers, and goes. A tap presses and
 * lifts, a double tap does so twice, quickly, a hold presses and stays
 * down while a ring fills under it, and a drag presses, moves
 * through its targets in turn, and lifts. The show is a sequence of timed
 * legs, made as the demo changes, from where the game says its targets are
 * on the screen. A touch's ripple is a step of its own, which runs
 * alongside the legs after the touch. The pose is in the screen's pixels.
 */
export interface PointerViewModel {
    /** Where the arrow's tip is, and how clearly it shows, from 0 to 1. */
    readonly x: number;
    readonly y: number;
    readonly alpha: number;
    /** Whether the arrow is touching the screen. */
    readonly isDown: boolean;
    /** Where the arrow last touched down, which its ripple spreads from, and a drag trails from. */
    readonly touchX: number;
    readonly touchY: number;
    /** How far the last touch's ripple has spread, from 0 to 1, or 1 once it is gone. */
    readonly rippleProgress: number;
    /** How far a hold's ring has filled, from 0 to 1, or 0 while the arrow isn't holding. It fills where the arrow touched down. */
    readonly holdProgress: number;
    /** Moves the show on by `deltaMs`, starting it over as the demo changes, and as it ends. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PointerViewModelOptions<T> {
    /** What the arrow shows how to do. */
    readonly demo: () => Demo<T>;
    /** A count that rises each time the demo changes, which starts the show over. */
    readonly demosShown: () => number;
    /** Where `target` is, in the screen's pixels: the middle of a cell, say, or of a key. */
    readonly findPoint: (target: T) => ScreenPoint;
    /** The screen's size, which the arrow comes in from and goes off within. */
    readonly screenWidth: number;
    readonly screenHeight: number;
}

/** A place on the screen, in its pixels. */
export interface ScreenPoint {
    readonly x: number;
    readonly y: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the show for the demo as it is now, from its start. */
export function createPointerViewModel<T>(options: PointerViewModelOptions<T>): PointerViewModel {
    const { screenWidth, screenHeight } = options;
    // The show running, if any: its legs, the places they go, and the sequence that times them
    let show: Show | undefined;
    const watcher = watch({ shown: options.demosShown });
    const pose = { x: 0, y: 0, alpha: 0, isDown: false, touchX: 0, touchY: 0, rippleProgress: 1, holdProgress: 0 };
    chooseShow();

    return {
        get x() { return pose.x; },
        get y() { return pose.y; },
        get alpha() { return pose.alpha; },
        get isDown() { return pose.isDown; },
        get touchX() { return pose.touchX; },
        get touchY() { return pose.touchY; },
        get rippleProgress() { return pose.rippleProgress; },
        get holdProgress() { return pose.holdProgress; },
        update(deltaMs) {
            if (watcher.poll().shown.changed) chooseShow();
            if (show === undefined) return;
            if (!show.sequence.isActive) show.sequence.start();
            show.sequence.update(deltaMs);
            posePointer(show);
        },
    };

    /** Makes the show for the demo as it is now, and starts it. A demo with no touches has no show. */
    function chooseShow(): void {
        pose.alpha = 0;
        pose.rippleProgress = 1;
        pose.holdProgress = 0;
        const demo = options.demo();
        const points: ScreenPoint[] = [];
        for (let i = 0; i < demo.length; i++) {
            for (let j = 0; j < demo[i].targets.length; j++) points.push(options.findPoint(demo[i].targets[j]));
        }
        show = points.length === 0 ? undefined : createShow(demo, points);
        show?.sequence.start();
    }

    /**
     * The show for `demo`, whose targets are at `points`: the places it goes
     * are the points, with one away from the first before them, and one away
     * from the last after.
     */
    function createShow(demo: Demo<T>, points: readonly ScreenPoint[]): Show {
        const last = points[points.length - 1];
        const places: ScreenPoint[] = [findAway(points[0]), ...points, findAway(last)];
        const legs: Leg[] = [{ name: 'come', ms: COME_MS, to: 1, isDown: false, alpha: 1 }];
        let place = 1;
        for (let i = 0; i < demo.length; i++) {
            const { kind, targets } = demo[i];
            if (i > 0) {
                const distance = Math.hypot(places[place].x - places[place - 1].x, places[place].y - places[place - 1].y);
                legs.push({ name: `move-${i}`, ms: distance < FAR ? MOVE_MS : MOVE_MS * 2, to: place, isDown: false, alpha: 1 });
            }
            if (kind === 'tap') {
                legs.push({ name: `press-${i}`, ms: TAP_DOWN_MS, to: place, isDown: true, alpha: 1, ripples: true });
                legs.push({ name: `lift-${i}`, ms: TAP_UP_MS, to: place, isDown: false, alpha: 1 });
            }
            else if (kind === 'hold') {
                // No ripple, which would read as a tap: the ring that fills shows the hold instead
                legs.push({ name: `press-${i}`, ms: TAP_DOWN_MS, to: place, isDown: true, alpha: 1, touches: true });
                legs.push({ name: `hold-down-${i}`, ms: HOLD_MS, to: place, isDown: true, alpha: 1, holds: true });
                legs.push({ name: `lift-${i}`, ms: TAP_UP_MS, to: place, isDown: false, alpha: 1 });
            }
            else if (kind === 'double-tap') {
                legs.push({ name: `press-${i}`, ms: QUICK_TAP_MS, to: place, isDown: true, alpha: 1, ripples: true });
                legs.push({ name: `lift-${i}`, ms: QUICK_TAP_MS, to: place, isDown: false, alpha: 1 });
                legs.push({ name: `press-again-${i}`, ms: QUICK_TAP_MS, to: place, isDown: true, alpha: 1, ripples: true });
                legs.push({ name: `lift-again-${i}`, ms: TAP_UP_MS, to: place, isDown: false, alpha: 1 });
            }
            else {
                legs.push({ name: `press-${i}`, ms: TAP_DOWN_MS * 2, to: place, isDown: true, alpha: 1, ripples: true });
                const dragMs = Math.max(LEAST_DRAG_MS, DRAG_MS / Math.max(1, targets.length - 1));
                for (let j = 1; j < targets.length; j++) legs.push({ name: `drag-${i}-${j}`, ms: dragMs, to: place + j, isDown: true, alpha: 1 });
                legs.push({ name: `hold-${i}`, ms: TAP_DOWN_MS, to: place + targets.length - 1, isDown: true, alpha: 1 });
                legs.push({ name: `lift-${i}`, ms: TAP_UP_MS, to: place + targets.length - 1, isDown: false, alpha: 1 });
            }
            place += targets.length;
        }
        legs.push({ name: 'linger', ms: LINGER_MS, to: place - 1, isDown: false, alpha: 1 });
        legs.push({ name: 'go', ms: GO_MS, to: place, isDown: false, alpha: 0 });
        legs.push({ name: 'pause', ms: PAUSE_MS, to: place, isDown: false, alpha: 0 });
        return timeLegs(legs, places);
    }

    /** Works out the pose from how far through its legs the show is. */
    function posePointer(running: Show): void {
        const { legs, places, steps, ripples } = running;
        let fromX = places[0].x;
        let fromY = places[0].y;
        let fromAlpha = 0;
        pose.x = fromX;
        pose.y = fromY;
        pose.alpha = 0;
        pose.isDown = false;
        pose.rippleProgress = 1;
        pose.holdProgress = 0;
        for (let i = 0; i < legs.length; i++) {
            const leg = legs[i];
            const step = steps[i];
            if (!step.isActive && step.progress <= 0) break;
            const to = places[leg.to];
            const t = easeInOut(step.progress);
            pose.x = fromX + (to.x - fromX) * t;
            pose.y = fromY + (to.y - fromY) * t;
            pose.alpha = fromAlpha + (leg.alpha - fromAlpha) * t;
            pose.isDown = leg.isDown;
            const ripple = ripples[i];
            if (ripple !== undefined || leg.touches === true) {
                // A touch ripples from where it went down, which a drag that follows trails from, and a hold fills at
                pose.touchX = fromX;
                pose.touchY = fromY;
                pose.rippleProgress = ripple?.isActive === true ? ripple.progress : 1;
            }
            pose.holdProgress = leg.holds === true && step.isActive ? step.progress : 0;
            fromX = to.x;
            fromY = to.y;
            fromAlpha = leg.alpha;
        }
    }

    /** Away from `point`, to the right and below, or to the left near the right edge, so the arrow stays on screen. */
    function findAway(point: ScreenPoint): ScreenPoint {
        return {
            x: point.x + AWAY_X < screenWidth ? point.x + AWAY_X : point.x - AWAY_X,
            y: Math.min(screenHeight - 20, point.y + AWAY_Y),
        };
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * A leg of a show: a step, which moves the arrow to a place over its time,
 * touching the screen or not, and fading to an alpha on the way. A leg that
 * touches down sets where the touch is, and sends out a ripple if it is a
 * tap's. A hold's leg fills its ring as it goes. Its place is an index into
 * the show's places.
 */
interface Leg {
    readonly name: string;
    readonly ms: number;
    readonly to: number;
    readonly isDown: boolean;
    readonly alpha: number;
    readonly touches?: boolean;
    readonly ripples?: boolean;
    readonly holds?: boolean;
}

/** A show: its legs, in order, the places they go, and the sequence that times them, with each leg's step, and the ripple alongside each touch. */
interface Show {
    readonly legs: readonly Leg[];
    readonly places: readonly ScreenPoint[];
    readonly sequence: Sequence;
    readonly steps: readonly StepState[];
    readonly ripples: readonly (StepState | undefined)[];
}

/** How far through a step of a sequence is. */
type StepState = Sequence['steps'][string];

const COME_MS = 600;
const TAP_DOWN_MS = 150;
const TAP_UP_MS = 300;
const QUICK_TAP_MS = 110;
/** How long a hold stays down after it presses, while its ring fills: long enough to see it fill. */
const HOLD_MS = 1100;
/** A move between touches, doubled for one this far or further, in pixels. */
const MOVE_MS = 380;
const FAR = 200;
/** A whole drag, shared between its steps, each no quicker than the least. */
const DRAG_MS = 800;
const LEAST_DRAG_MS = 320;
const LINGER_MS = 500;
const GO_MS = 450;
/** How long the screen is left clear before the show starts over. */
const PAUSE_MS = 700;
const RIPPLE_MS = 450;
/** Where the arrow waits, out of the way, before it comes in and after it goes: this far from its first and last points. */
const AWAY_X = 80;
const AWAY_Y = 110;

/** Makes the sequence that times `legs`, one after another, with a ripple starting alongside each touch. */
function timeLegs(legs: readonly Leg[], places: readonly ScreenPoint[]): Show {
    const steps: StepDef[] = [];
    let startMs = 0;
    for (let i = 0; i < legs.length; i++) {
        const { name, ms, ripples } = legs[i];
        steps.push({ name, startMs, durationMs: ms });
        if (ripples === true) steps.push({ name: toRippleName(name), startMs, durationMs: RIPPLE_MS });
        startMs += ms;
    }
    const sequence = createSequence(steps);
    return {
        legs,
        places,
        sequence,
        steps: legs.map((leg) => sequence.steps[leg.name]),
        ripples: legs.map((leg) => (leg.ripples === true ? sequence.steps[toRippleName(leg.name)] : undefined)),
    };
}

function toRippleName(legName: string): string {
    return `${legName}-ripple`;
}

/** Eases from 0 to 1, slow at both ends: the smoothstep curve. */
function easeInOut(t: number): number {
    return t * t * (3 - 2 * t);
}
