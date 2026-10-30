import { assert } from '../assert';
import type { CheckedComputedGetters } from './error-checks';
import type { Getter } from './watched';
import { createWatchedGetters, rereadEvery, type WatchedGetters } from './watched-getters';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A computed value: call it to read the value. */
export interface Computed<R> {
    (): R;
    /** Rises whenever the value may have changed, so a computed object can be watched by its version. */
    readonly version: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a computed value, which computes on its first read, and again only when what it watches has changed. */
export function createComputed<const S extends Getter | { readonly [name: string]: Getter } | readonly Getter[], R>(
    options: {
        readonly watch: S & CheckedComputedGetters<S>;
        // For an object to update in place, give `compute` a second parameter with a default, which makes the object.
        // It's left out of this type on purpose, so it takes its type from its default, and `R` is still inferred.
        readonly compute: (current: ValuesOf<S>) => R;
    },
): Computed<R> {
    const { watch } = options;
    const compute = options.compute as (current: unknown, last: unknown) => R;
    assert(
        !Array.isArray(watch),
        'createComputed watches one getter, or a record of getters, not an array. Name the values in a record.',
    );
    // A record's names, and the values by those names that `compute` is given
    const keys = typeof watch === 'object' ? Object.keys(watch) : undefined;
    const values: Record<string, unknown> = {};
    assert(
        keys === undefined || keys.length > 0,
        'createComputed was given an empty record, which never changes. Give it at least one getter.',
    );

    // Made on the first read, which reads every getter for the first time
    let watchedGetters: WatchedGetters | undefined;
    let hasResult = false;
    let result: R | undefined;
    let version = 0;
    let isComputing = false;

    const computed = (() => {
        bringUpToDate();
        return result as R;
    }) as Computed<R>;
    Object.defineProperty(computed, 'version', {
        get: () => {
            bringUpToDate();
            return version;
        },
    });
    return computed;

    function bringUpToDate(): void {
        if (isComputing) throw new Error('createComputed: a computed value read itself while it was being computed.');
        isComputing = true;
        try {
            let hasChanged: boolean;
            if (watchedGetters === undefined) {
                const name = 'createComputed: watch';
                watchedGetters = createWatchedGetters({ getters: watch, name, isWatcher: false });
                hasChanged = true;
            }
            else {
                hasChanged = rereadEvery(watchedGetters.watched);
            }
            if (hasChanged || !hasResult) recompute(watchedGetters);
        }
        finally {
            isComputing = false;
        }
    }

    function recompute(watchedGetters: WatchedGetters): void {
        // On the first compute, `last` is undefined, so a default for it makes the object to maintain
        const next = compute(collectValues(watchedGetters), result);
        // An object can't be compared with what it was, so every recompute of one counts as a change
        if (!hasResult || next !== result || isObjectLike(next)) version++;
        result = next;
        hasResult = true;
    }

    /** What `compute` is given: one value, or a record of them by name. */
    function collectValues(watchedGetters: WatchedGetters): unknown {
        const watched = watchedGetters.watched;
        if (keys === undefined) return watched[0].current;
        // `watched` follows `Object.keys`, as `keys` does. Until the first result, every value is new
        for (let i = 0; i < keys.length; i++) {
            if (!hasResult || watched[i].changed) values[keys[i]] = watched[i].current;
        }
        return values;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What `compute` is given: one value, or a record of them. */
type ValuesOf<S> = S extends readonly unknown[]
    ? never
    : S extends () => infer T
        ? T
        : { readonly [K in keyof S]: S[K] extends () => infer T ? T : never };

function isObjectLike(value: unknown): boolean {
    return value !== null && (typeof value === 'object' || typeof value === 'function');
}
