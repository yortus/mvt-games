// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Watch<T> {
    /**
     * Poll the getter. Returns `1` when the value differs from the last poll,
     * `0` otherwise. Numeric return allows bitwise `|` to combine multiple
     * watches without short-circuit skipping.
     */
    changed(): number;
    /** Most recent value (updated each time `changed()` is called). */
    readonly value: T;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createWatch<T>(read: () => T): Watch<T> {
    let current = read();

    return {
        changed(): number {
            const next = read();
            if (next === current) return 0;
            current = next;
            return 1;
        },
        get value(): T {
            return current;
        },
    };
}
