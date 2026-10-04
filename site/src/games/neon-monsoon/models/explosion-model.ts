import type { ExplosionSize } from './common';
import { EXPLOSION_MS } from './model-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An explosion where something was destroyed. It has no effect on play; the
 * model keeps it so that every explosion is part of the replayable game, in
 * the same place on every run.
 */
export interface ExplosionModel {
    readonly size: ExplosionSize;
    /** Position in world-units. */
    readonly x: number;
    readonly y: number;
    /** From 0, just started, to 1, finished. */
    readonly progress: number;
    readonly isFinished: boolean;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ExplosionModelOptions {
    readonly size: ExplosionSize;
    readonly x: number;
    readonly y: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createExplosionModel(options: ExplosionModelOptions): ExplosionModel {
    const { size, x, y } = options;
    const durationMs = EXPLOSION_MS[size];
    let elapsedMs = 0;

    const model: ExplosionModel = {
        size,
        x,
        y,
        get progress() {
            return elapsedMs / durationMs;
        },
        get isFinished() {
            return elapsedMs >= durationMs;
        },

        update(deltaMs) {
            elapsedMs = Math.min(elapsedMs + deltaMs, durationMs);
        },
    };

    return model;
}
