// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** A new record with the same keys as `record`, and each value passed through `map`. */
export function mapValues<T, U>(record: Readonly<Record<string, T>>, map: (value: T, key: string) => U): Record<string, U> {
    return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, map(value, key)]));
}
