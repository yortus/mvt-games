// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface WatchedProperty<T> {
    readonly changed: boolean;
    readonly value: T;
    readonly previous: T;
}

type Watcher<T extends Record<string, () => unknown>> = {
    /** Polls all getters and updates change flags. Returns true if any value changed. */
    poll(): boolean;
} & { readonly [K in keyof T]: WatchedProperty<ReturnType<T[K]>> };

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createWatcher<T extends Record<string, () => unknown>>(getters: T): Watcher<T> {
    const keys = Object.keys(getters) as (keyof T)[];
    const reads = keys.map(k => getters[k]);
    const state = reads.map(read => {
        const initial = read();
        return { changed: false, value: initial, previous: initial };
    });

    const watcher: Record<string, unknown> = {
        poll(): boolean {
            let anyChanged = false;
            for (let i = 0; i < keys.length; i++) {
                const next = reads[i]();
                const s = state[i];
                s.previous = s.value;
                s.changed = next !== s.value;
                if (s.changed) {
                    s.value = next;
                    anyChanged = true;
                }
            }
            return anyChanged;
        },
    };

    for (let i = 0; i < keys.length; i++) {
        Object.defineProperty(watcher, keys[i], {
            get: () => state[i],
            enumerable: true,
        });
    }

    return watcher as Watcher<T>;
}
