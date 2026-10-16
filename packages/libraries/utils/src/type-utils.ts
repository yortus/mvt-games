// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Recursively applies `readonly` to `T`.
 * Arrays become `readonly` arrays, objects get `readonly` properties,
 * and primitives pass through unchanged.
 */
export type DeepReadonly<T> =
    T extends (infer U)[] ? readonly DeepReadonly<U>[]
        : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
            : T;
