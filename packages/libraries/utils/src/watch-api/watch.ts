import { assert } from '../assert';
import { createReadingGuard, type CheckedWatchGetters } from './error-checks';
import { rereadWatched, type Getter, type WatchedOf } from './watched';
import { createWatchedGetters } from './watched-getters';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Watcher<S> {
    /** Reads every getter, and says what changed since the last poll. The reading is reused: don't keep it. */
    readonly poll: () => Reading<S>;
}

/** For one getter, its `Watched`. For a record or an array, a `Watched` for each getter, and `anyChanged`. */
export type Reading<S> = S extends readonly Getter[]
    ? { readonly [I in keyof S]: WatchedOf<ValueOf<S[I]>> } & { readonly anyChanged: boolean }
    : S extends Getter
        ? WatchedOf<ValueOf<S>>
        : { readonly [K in keyof S]: WatchedOf<ValueOf<S[K]>> } & { readonly anyChanged: boolean };

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a watcher of one getter, or a record or array of getters. It reads them now, as its baseline. */
export function watch<const S extends Getter | { readonly [name: string]: Getter } | readonly Getter[]>(
    getters: S & CheckedWatchGetters<S>,
): Watcher<S> {
    assert(
        typeof getters !== 'object' || Array.isArray(getters) || !('anyChanged' in getters),
        'watch was given a getter called anyChanged. The reading uses that name, so give it another.',
    );
    const { reading, watched } = createWatchedGetters({ getters, name: 'watch', isWatcher: true });
    // Each shape gets its own poll, with nothing between it and the shared functions it calls, since there may
    // be thousands of watchers, polled on every step
    const poll = typeof getters === 'function' ? pollOne : pollEvery;
    if (!DEV) return { poll };
    // In development, each poll wraps the reading so that using it after the next poll throws
    const guardedReading = createReadingGuard({ reading, watched });
    return {
        poll: () => {
            poll();
            return guardedReading() as Reading<S>;
        },
    };

    function pollOne(): Reading<S> {
        rereadWatched(watched[0]);
        return reading as Reading<S>;
    }

    function pollEvery(): Reading<S> {
        let anyChanged = false;
        for (let i = 0; i < watched.length; i++) {
            if (rereadWatched(watched[i])) anyChanged = true;
        }
        (reading as { anyChanged: boolean }).anyChanged = anyChanged;
        return reading as Reading<S>;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Vite replaces `import.meta.env.DEV` at build time; plain Node has no
// `import.meta.env`, so it is read defensively.
const DEV = import.meta.env?.DEV === true;

type ValueOf<G> = G extends () => infer T ? T : never;
