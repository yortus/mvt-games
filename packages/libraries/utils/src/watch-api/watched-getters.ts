import { assert } from '../assert';
import { createWatched, rereadWatched, type Getter, type MutableWatched } from './watched';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A `MutableWatched` for each getter that `watch` or `createComputed` was given. */
export interface WatchedGetters {
    /** What a watcher's `poll()` returns: the one getter's `Watched`, or a record or array of them, with `anyChanged`. */
    readonly reading: unknown;
    readonly watched: readonly MutableWatched[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WatchedGettersOptions {
    /** One getter, or a record or an array of them. */
    readonly getters: unknown;
    /** For error messages, such as `watch`. */
    readonly name: string;
    readonly isWatcher: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a `MutableWatched` for each getter, which reads it now, as its baseline. */
export function createWatchedGetters(options: WatchedGettersOptions): WatchedGetters {
    const { getters, name, isWatcher } = options;
    if (typeof getters === 'function') {
        const watched = createWatched({ getter: getters as Getter, name, isWatcher });
        return { reading: watched, watched: [watched] };
    }
    if (Array.isArray(getters)) return watchArray(getters, name, isWatcher);
    assert(
        typeof getters === 'object' && getters !== null,
        () => `${name} takes a getter, or a record or array of getters, not ${String(getters)}.`,
    );
    return watchRecord(getters as Readonly<Record<string, unknown>>, name, isWatcher);
}

/**
 * Reads every getter again, and returns whether any value changed. Like
 * `rereadWatched`, it's one function for every computed value, not a closure each.
 */
export function rereadEvery(watched: readonly MutableWatched[]): boolean {
    let anyChanged = false;
    for (let i = 0; i < watched.length; i++) {
        if (rereadWatched(watched[i])) anyChanged = true;
    }
    return anyChanged;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function watchArray(given: readonly unknown[], name: string, isWatcher: boolean): WatchedGetters {
    const watched: MutableWatched[] = [];
    for (let i = 0; i < given.length; i++) {
        watched.push(createWatched({ getter: given[i] as Getter, name: `${name}[${i}]`, isWatcher }));
    }
    return { reading: Object.assign(watched.slice(), { anyChanged: false }), watched };
}

function watchRecord(given: Readonly<Record<string, unknown>>, name: string, isWatcher: boolean): WatchedGetters {
    const keys = Object.keys(given);
    assert(
        keys.length > 0,
        () => `${name} was given an empty record, which never changes. Give it at least one getter.`,
    );
    const watched: MutableWatched[] = [];
    const reading: Record<string, unknown> = { anyChanged: false };
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        watched.push(createWatched({ getter: given[key] as Getter, name: `${name}.${key}`, isWatcher }));
        reading[key] = watched[i];
    }
    return { reading, watched };
}
