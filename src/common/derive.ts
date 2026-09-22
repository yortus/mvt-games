import { watch, type WatchGetters, type WatchedValues } from './watch';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A memoised value derived from a set of watched triggers. `poll()` returns the
 * current value, recomputing it only when a trigger changed since the previous
 * poll. Sibling to `watch`: where `watch` reports *what changed*, `derive`
 * reports *the value those changes produce*.
 */
export interface Derived<T> {
    /** Recompute if a trigger changed since the last poll, then return the value. */
    poll(): T;
    /** Whether the most recent `poll()` recomputed the value. */
    readonly changed: boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DeriveOptions<S extends WatchGetters, T> {
    /** Primitive triggers; a change in any of them recomputes the value. */
    watch: S;
    /** Initial value, also passed as `previous` on the first computation. */
    initial: T;
    /**
     * Produce the current value from the previous one and the current trigger
     * readings. May mutate `previous` in place and return it, or return a fresh
     * value. Runs only when a trigger changed (and once on the first poll).
     */
    compute(previous: T, watched: WatchedValues<S>): T;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function derive<S extends WatchGetters, T>(options: DeriveOptions<S, T>): Derived<T> {
    const watcher = watch(options.watch);
    const keys = Object.keys(options.watch) as (keyof S)[];
    const compute = options.compute;
    let value = options.initial;
    let lastChanged = false;

    return {
        poll(): T {
            const watched = watcher.poll();
            let changed = false;
            for (let i = 0; i < keys.length; ++i) {
                if (watched[keys[i]].changed) {
                    changed = true;
                    break;
                }
            }
            lastChanged = changed;
            if (changed) value = compute(value, watched);
            return value;
        },
        get changed(): boolean {
            return lastChanged;
        },
    };
}
