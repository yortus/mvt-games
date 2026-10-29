import { assert } from '../assert';
import { createReadingGuard, type CheckedWatchGetters } from './error-checks';
import type { Getter, WatchedOf } from './watched';
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
    const { reading, watched, reread } = createWatchedGetters({ getters, name: 'watch', isWatcher: true });
    // In development, each poll wraps the reading so that using it after the next poll throws
    const guardedReading = DEV ? createReadingGuard({ reading, watched }) : () => reading;
    return {
        poll: () => {
            reread();
            return guardedReading() as Reading<S>;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Vite replaces `import.meta.env.DEV` at build time; plain Node has no
// `import.meta.env`, so it is read defensively.
const DEV = import.meta.env?.DEV === true;

type ValueOf<G> = G extends () => infer T ? T : never;
