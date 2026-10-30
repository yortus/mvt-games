import { assert } from '../assert';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a watch knows about one value since its last read. */
export interface Watched<T> {
    readonly current: T;
    /** Equal to `current` when nothing changed. */
    readonly previous: T;
    readonly changed: boolean;
    readonly changedTo: (value: T) => boolean;
    readonly changedFrom: (value: T) => boolean;
}

/** A watched number or `bigint`, which also says which way it moved. */
export interface WatchedNumber<T extends number | bigint = number> extends Watched<T> {
    readonly increased: boolean;
    readonly decreased: boolean;
}

/** Any primitive: what a getter must return to be watched. */
// eslint-disable-next-line @mvtjs/no-null -- a watched value may be `null`, from a model or an outside API
export type Watchable = string | number | bigint | boolean | symbol | null | undefined;

export type Getter = () => Watchable;

/** Only a value that's always a number, or always a `bigint`, gets `increased` and `decreased`. */
export type WatchedOf<T> = [T] extends [number | bigint] ? WatchedNumber<T & (number | bigint)> : Watched<T>;

/**
 * The library's own, writable `Watched`, one for each watched getter, which
 * all three tools are built from. A watcher hands it out as its reading. It
 * has every member of a `WatchedNumber`, so every one has the same shape. It
 * keeps its getter and name too, so a poll reads one object for each getter.
 */
export interface MutableWatched {
    readonly getter: Getter;
    /** For error messages, such as `watch.phase`. */
    readonly name: string;
    current: unknown;
    previous: unknown;
    changed: boolean;
    increased: boolean;
    decreased: boolean;
    /** Only a watcher hands it out, so only a watcher's have these. */
    readonly changedTo: ((value: unknown) => boolean) | undefined;
    readonly changedFrom: ((value: unknown) => boolean) | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WatchedOptions {
    readonly getter: Getter;
    /** For error messages, such as `watch.phase`. */
    readonly name: string;
    readonly isWatcher: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the `MutableWatched` for one getter, and reads it now, as the baseline. */
export function createWatched(options: WatchedOptions): MutableWatched {
    const { getter, name, isWatcher } = options;
    assert(typeof getter === 'function', () => `${name} must be a getter, a function that returns the value to watch.`);
    const first = checkWatchable(getter(), name);
    const watched: MutableWatched = {
        getter,
        name,
        current: first,
        previous: first,
        changed: false,
        increased: false,
        decreased: false,
        changedTo: isWatcher ? (value) => watched.changed && watched.current === value : undefined,
        changedFrom: isWatcher ? (value) => watched.changed && watched.previous === value : undefined,
    };
    return watched;
}

/**
 * Reads the getter again, and returns whether its value changed. It's one
 * function for every watched getter, rather than a closure each, since there
 * may be thousands.
 */
export function rereadWatched(watched: MutableWatched): boolean {
    const next = watched.getter();
    const last = watched.current;
    if (next === last) {
        // A steady value is the common case, and nothing needs writing unless the last read was a change
        if (watched.changed) {
            watched.previous = last;
            watched.changed = false;
            watched.increased = false;
            watched.decreased = false;
        }
        return false;
    }
    // A value equal to the last one already passed this check, so steady reads skip it
    checkWatchable(next, watched.name);
    watched.previous = last;
    watched.current = next;
    watched.changed = true;
    const isOrdered = isNumeric(next) && isNumeric(last);
    watched.increased = isOrdered && (next as number) > (last as number);
    watched.decreased = isOrdered && (next as number) < (last as number);
    return true;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns `value`, or throws if it isn't a primitive. In production too, where a slip costs the most. */
function checkWatchable(value: unknown, name: string): unknown {
    // `typeof null` is 'object', and null is watchable
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
    const what = Array.isArray(value) ? 'an array' : typeof value === 'object' ? 'an object' : 'a function';
    throw new Error(
        `${name} gave ${what}, which can't be watched, because a change inside it would leave it equal to itself. `
        + 'Watch a primitive that changes with it, such as a count or a version, '
        + "or compute the value with createComputed and watch the computed value's version.",
    );
}

function isNumeric(value: unknown): boolean {
    return typeof value === 'number' || typeof value === 'bigint';
}
