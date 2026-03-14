// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Watcher<T extends Record<string, () => unknown>> {
    /** Poll all getters, update change flags, and return the watched values. */
    poll(): WatchedValues<T>;
}

export type WatchedValues<T extends Record<string, () => unknown>> = {
    readonly [K in keyof T]: WatchedProperty<ReturnType<T[K]>>;
};

export interface WatchedProperty<T> {
    readonly changed: boolean;
    readonly value: T;
    readonly previous: T | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function watch<T extends Record<string, () => unknown>>(getters: T): Watcher<T> {
    const keys = Object.keys(getters) as (keyof T)[];
    const reads = keys.map(k => getters[k]);
    const state = reads.map(() => ({
        changed: false,
        value: undefined as unknown,
        previous: undefined as unknown,
    }));
    const watched = Object.fromEntries(keys.map((k, i) => [k, state[i]])) as WatchedValues<T>;

    return {
        poll(): WatchedValues<T> {
            for (let i = 0; i < keys.length; ++i) {
                const next = reads[i]();
                const s = state[i];
                s.previous = s.value;
                s.changed = next !== s.value;
                if (s.changed) s.value = next;
            }
            return watched;
        },
    };
}
