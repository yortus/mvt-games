import { updateView, type View } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AdvanceTimeOptions {
    readonly totalMs: number;
    /** Each step: every model's `update`, in order... */
    readonly models?: readonly { readonly update: (deltaMs: number) => void }[];
    /** ...then `updateView` on every view. */
    readonly views?: readonly View[];
    /** Default 16, a frame at 60 frames a second, as the thumbnail page steps. */
    readonly stepMs?: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Advances models and views by `totalMs`, in frame-sized steps, as the
 * host does: each step updates every model, then every view, then awaits a
 * microtask, so a model with an internal `await` moves on. It does not
 * refresh: a picture is refreshed once, before it is drawn, as the host
 * refreshes once per frame. The steps are small because models with phases
 * or timelines are not leap-safe: one giant step would skip what happens
 * between.
 */
export async function advanceTime(options: AdvanceTimeOptions): Promise<void> {
    const { totalMs, models = [], views = [], stepMs = 16 } = options;
    let remaining = totalMs;
    while (remaining > 0) {
        const step = Math.min(stepMs, remaining);
        for (let i = 0; i < models.length; i++) models[i].update(step);
        for (let i = 0; i < views.length; i++) updateView(views[i], step);
        await Promise.resolve();
        remaining -= step;
    }
}
