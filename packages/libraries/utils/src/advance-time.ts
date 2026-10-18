import { describeValue, isView, updateView, type View } from './view-tick-api';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A model, or anything else with an update step, or a view of any installed renderer. */
export type Advanceable = { readonly update: (deltaMs: number) => void } | View;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Advances models and views by `ms` milliseconds, in steps of 16 ms (one
 * frame), as a game loop does, for tests and other runs without a loop.
 *
 * In each step, it calls `update` on everything that is not a view, in the
 * order given, then `updateView` on every view, in the order given. So
 * models always come before views, whatever the order of the arguments.
 * Then it awaits a microtask, so that a model with an internal `await`
 * moves on. It does not refresh. Refresh the views once afterwards, as a
 * game loop does once per frame.
 *
 * The steps are small because models with phases or timelines cannot
 * safely jump ahead. One giant step would skip what happens in between.
 *
 * A view is told apart by its renderer, not by its methods, so a view that
 * has an `update` method of its own is still updated as a view. An argument
 * that is neither a view nor has an `update` method throws.
 */
export async function advanceTime(ms: number, ...items: readonly Advanceable[]): Promise<void> {
    const models: { readonly update: (deltaMs: number) => void }[] = [];
    const views: View[] = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (isView(item)) views.push(item);
        else if (typeof (item as { readonly update?: unknown }).update === 'function') models.push(item);
        else throw new Error(`[mvt] advanceTime() was given ${describeValue(item)}, which is neither a view nor has an update method.`);
    }
    let remaining = ms;
    while (remaining > 0) {
        const step = Math.min(STEP_MS, remaining);
        for (let i = 0; i < models.length; i++) models[i].update(step);
        for (let i = 0; i < views.length; i++) updateView(views[i], step);
        await Promise.resolve();
        remaining -= step;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One frame at 60 frames a second, rounded down. */
const STEP_MS = 16;
