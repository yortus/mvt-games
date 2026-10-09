// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Values safe for `===` change detection. Excludes objects and arrays. */
// eslint-disable-next-line @mvtjs/no-null -- a watched value may be `null`, from a model or an outside API
export type Watchable = string | number | boolean | null | undefined;

export interface Watcher<T extends Record<string, () => Watchable>> {
    /** Poll all getters, update change flags, and return the watched values. */
    poll: () => WatchedValues<T>;
}

/**
 * The watched values, one for each getter. A getter that returns a number
 * gives a `WatchedNumber`, which also has `increased` and `decreased`. Any
 * other getter gives a `WatchedProperty`.
 */
export type WatchedValues<T extends Record<string, () => Watchable>> = {
    readonly [K in keyof T]: ReturnType<T[K]> extends number
        ? WatchedNumber<ReturnType<T[K]>>
        : WatchedProperty<ReturnType<T[K]>>;
};

export interface WatchedProperty<T> {
    readonly changed: boolean;
    readonly value: T;
    readonly previous: T | undefined;
}

/** A watched property whose value is a number. It also says which way the value moved. */
export interface WatchedNumber<T extends number> extends WatchedProperty<T> {
    /**
     * Whether the value changed on this poll to a number greater than
     * `previous`. It is false on the first poll, because `previous` is
     * `undefined` then. It is also false when nothing changed.
     */
    readonly increased: boolean;
    /**
     * Whether the value changed on this poll to a number less than
     * `previous`. It is false on the first poll, because `previous` is
     * `undefined` then. It is also false when nothing changed.
     */
    readonly decreased: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function watch<T extends Record<string, () => Watchable>>(getters: T): Watcher<T> {
    const keys = Object.keys(getters) as (keyof T)[];
    const reads = keys.map((k) => getters[k]);
    // Every property gets `increased` and `decreased`, so all share one shape.
    // They stay false unless the value moves from one number to another.
    const state = reads.map(() => ({
        changed: false,
        value: undefined as unknown,
        previous: undefined as unknown,
        increased: false,
        decreased: false,
    }));
    const watched = Object.fromEntries(keys.map((k, i) => [k, state[i]])) as WatchedValues<T>;

    return {
        poll(): WatchedValues<T> {
            for (let i = 0; i < keys.length; ++i) {
                const next = reads[i]();
                const s = state[i];
                const last = s.value;
                const changed = next !== last;
                s.previous = last;
                s.changed = changed;
                if (changed) s.value = next;
                const isNumberChange = changed && typeof next === 'number' && typeof last === 'number';
                s.increased = isNumberChange && next > last;
                s.decreased = isNumberChange && next < last;
            }
            return watched;
        },
    };
}
