import { assert } from '@mvtjs/utils';
import {
    ARENA_WIDTH,
    type BulletKind,
    type FanPattern,
    type PatternDef,
    type RainPattern,
    type RingPattern,
    type StreamPattern,
} from '../data';
import type { BulletField } from './bullet-field';
import type { Point } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Runs one bullet pattern: fires a volley every `intervalMs` into a bullet
 * field, from where its owner is, at the time each volley is due. The
 * pattern is data (`PatternDef`); this is the clock and the geometry.
 *
 * Fires only in its own `update`, counting model time, so a pattern comes
 * out identically on every run.
 */
export interface EmitterModel {
    /** True once the pattern's `durationMs` has passed. */
    readonly isFinished: boolean;
    /** Fire one volley now, outside the pattern's timing, such as a ring left behind on death. */
    fireVolley: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EmitterModelOptions {
    readonly pattern: PatternDef;
    readonly bullets: BulletField<BulletKind>;
    /** Where the emitter is attached, read at every volley. */
    readonly origin: Point;
    /** What aimed patterns aim at, read at every volley. */
    readonly target: Point;
    /** Multiplies bullet speeds, for harder loops. Defaults to 1. */
    readonly speedScale?: number;
    /** Divides the time between volleys, for harder loops. Defaults to 1. */
    readonly densityScale?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEmitterModel(options: EmitterModelOptions): EmitterModel {
    const { pattern, bullets, origin, target, speedScale = 1, densityScale = 1 } = options;
    assert(pattern.intervalMs > 0, 'emitter: a pattern needs a positive intervalMs');
    const intervalMs = pattern.intervalMs / densityScale;
    const delayMs = pattern.delayMs ?? 0;
    // When the pattern stops firing, counted from when the emitter started.
    const endMs = delayMs + (pattern.durationMs ?? Infinity);
    const offsetX = pattern.offsetX ?? 0;
    const offsetY = pattern.offsetY ?? 0;

    let elapsedMs = 0;
    let untilVolleyMs = delayMs;
    let isFinished = false;

    // Rings turn from volley to volley.
    let spinAngle = (pattern.kind === 'ring' ? (pattern.angleDeg ?? 90) : 0) * DEG_TO_RAD;
    // Streams fire their burst one bullet at a time.
    let burstShotsLeft = 0;
    let untilBurstShotMs = 0;
    // Rain's gap drifts across the lanes, turning back at the edges.
    let gapLane = pattern.kind === 'rain' ? Math.floor((pattern.lanes - pattern.gapLanes) / 2) : 0;
    let gapDirection = 1;

    const model: EmitterModel = {
        get isFinished() {
            return isFinished;
        },

        fireVolley,

        update(deltaMs) {
            if (isFinished) return;
            elapsedMs += deltaMs;

            // Fire every volley that has come due, unless it came due after the end.
            untilVolleyMs -= deltaMs;
            while (untilVolleyMs <= 0 && elapsedMs + untilVolleyMs < endMs) {
                fireVolley();
                untilVolleyMs += intervalMs;
            }
            if (pattern.kind === 'stream') fireDueBurstShots(pattern, deltaMs);

            if (elapsedMs >= endMs) isFinished = true;
        },
    };

    return model;

    // ---- Volleys -----------------------------------------------------------

    function fireVolley(): void {
        switch (pattern.kind) {
            case 'ring':
                fireRing(pattern);
                break;
            case 'fan':
                fireFan(pattern);
                break;
            case 'stream':
                startBurst(pattern);
                break;
            case 'rain':
                fireRain(pattern);
                break;
        }
    }

    function fireRing(ring: RingPattern): void {
        const step = (Math.PI * 2) / ring.count;
        for (let i = 0; i < ring.count; i++) {
            fire(ring, originX(), originY(), spinAngle + i * step);
        }
        spinAngle += (ring.spinPerVolleyDeg ?? 0) * DEG_TO_RAD;
    }

    function fireFan(fan: FanPattern): void {
        const x = originX();
        const y = originY();
        const centre = fan.isAimed ? angleToTarget(x, y) : (fan.angleDeg ?? 90) * DEG_TO_RAD;
        const spread = fan.spreadDeg * DEG_TO_RAD;
        if (fan.count === 1) {
            fire(fan, x, y, centre);
            return;
        }
        for (let i = 0; i < fan.count; i++) {
            fire(fan, x, y, centre - spread / 2 + (spread * i) / (fan.count - 1));
        }
    }

    function startBurst(stream: StreamPattern): void {
        burstShotsLeft = stream.burst;
        untilBurstShotMs = 0;
        fireDueBurstShots(stream, 0);
    }

    function fireDueBurstShots(stream: StreamPattern, deltaMs: number): void {
        untilBurstShotMs -= deltaMs;
        while (burstShotsLeft > 0 && untilBurstShotMs <= 0) {
            const x = originX();
            const y = originY();
            fire(stream, x, y, stream.isAimed ? angleToTarget(x, y) : DOWN);
            burstShotsLeft--;
            untilBurstShotMs += stream.burstGapMs / densityScale;
        }
    }

    function fireRain(rain: RainPattern): void {
        const laneWidth = ARENA_WIDTH / rain.lanes;
        for (let lane = 0; lane < rain.lanes; lane++) {
            if (lane >= gapLane && lane < gapLane + rain.gapLanes) continue;
            fire(rain, (lane + 0.5) * laneWidth, RAIN_Y, DOWN);
        }
        const lastGapLane = rain.lanes - rain.gapLanes;
        gapLane += gapDirection * rain.gapDriftPerVolley;
        if (gapLane <= 0 || gapLane >= lastGapLane) {
            gapLane = Math.max(0, Math.min(lastGapLane, gapLane));
            gapDirection = -gapDirection;
        }
    }

    // ---- Helpers -----------------------------------------------------------

    function fire(def: PatternDef, x: number, y: number, angle: number): void {
        bullets.fire(x, y, angle, def.bullet, def.motion, speedScale);
    }

    function originX(): number {
        return origin.x + offsetX;
    }

    function originY(): number {
        return origin.y + offsetY;
    }

    function angleToTarget(x: number, y: number): number {
        return Math.atan2(target.y - y, target.x - x);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEG_TO_RAD = Math.PI / 180;
const DOWN = Math.PI / 2;
/** Rain starts just above the top edge. */
const RAIN_Y = -6;
