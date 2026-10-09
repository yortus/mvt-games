import { updateView, type View } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AdvanceTimeOptions {
    readonly totalMs: number;
    /** The models to update. Each step calls every model's `update`, in order, before the views. */
    readonly models?: readonly { readonly update: (deltaMs: number) => void }[];
    /** The views to update. Each step calls `updateView` on every view, after the models. */
    readonly views?: readonly View[];
    /** The size of each step. The default is 16, which is one frame at 60 frames a second, rounded down. */
    readonly stepMs?: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Advances models and views by `totalMs`, in frame-sized steps, as a game
 * loop does. Each step updates every model, then every view, then awaits a
 * microtask, so that a model with an internal `await` moves on. It does not
 * refresh. A picture is refreshed once, before it is drawn, just as a game
 * loop refreshes once per frame. The steps are small because models
 * with phases or timelines cannot safely jump ahead. One giant step would
 * skip what happens in between.
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
