import { assert } from '../assert';
import { createWatched, rereadWatched, type Getter, type MutableWatched } from './watched';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A `MutableWatched` for each getter that `watch` or `createComputed` was given. */
export interface WatchedGetters {
    /** What a watcher's `poll()` returns. */
    readonly reading: unknown;
    readonly watched: readonly MutableWatched[];
    /** Reads every getter, and returns whether any value changed. */
    readonly reread: () => boolean;
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
    if (typeof getters === 'function') return watchOneGetter(getters as Getter, name, isWatcher);
    if (Array.isArray(getters)) return watchArray(getters, name, isWatcher);
    assert(
        typeof getters === 'object' && getters !== null,
        () => `${name} takes a getter, or a record or array of getters, not ${String(getters)}.`,
    );
    return watchRecord(getters as Readonly<Record<string, unknown>>, name, isWatcher);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function watchOneGetter(getter: Getter, name: string, isWatcher: boolean): WatchedGetters {
    const watched = createWatched({ getter, name, isWatcher });
    return { reading: watched, watched: [watched], reread: () => rereadWatched(watched, getter, name) };
}

function watchArray(given: readonly unknown[], name: string, isWatcher: boolean): WatchedGetters {
    const getters: Getter[] = [];
    const names: string[] = [];
    const watched: MutableWatched[] = [];
    for (let i = 0; i < given.length; i++) {
        const getter = given[i] as Getter;
        const getterName = `${name}[${i}]`;
        getters.push(getter);
        names.push(getterName);
        watched.push(createWatched({ getter, name: getterName, isWatcher }));
    }
    const reading = Object.assign(watched.slice(), { anyChanged: false });
    return { reading, watched, reread };

    function reread(): boolean {
        let anyChanged = false;
        for (let i = 0; i < watched.length; i++) {
            if (rereadWatched(watched[i], getters[i], names[i])) anyChanged = true;
        }
        reading.anyChanged = anyChanged;
        return anyChanged;
    }
}

function watchRecord(given: Readonly<Record<string, unknown>>, name: string, isWatcher: boolean): WatchedGetters {
    const keys = Object.keys(given);
    assert(
        keys.length > 0,
        () => `${name} was given an empty record, which never changes. Give it at least one getter.`,
    );
    const getters: Getter[] = [];
    const names: string[] = [];
    const watched: MutableWatched[] = [];
    const reading: Record<string, unknown> & { anyChanged: boolean } = { anyChanged: false };
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const getter = given[key] as Getter;
        const getterName = `${name}.${key}`;
        getters.push(getter);
        names.push(getterName);
        watched.push(createWatched({ getter, name: getterName, isWatcher }));
        reading[key] = watched[i];
    }
    return { reading, watched, reread };

    function reread(): boolean {
        let anyChanged = false;
        for (let i = 0; i < watched.length; i++) {
            if (rereadWatched(watched[i], getters[i], names[i])) anyChanged = true;
        }
        reading.anyChanged = anyChanged;
        return anyChanged;
    }
}
