// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns a cache's value for a key, making it if the cache has none. A
 * cache holds at most `limit` values. Making one more releases the value
 * that was used least recently, so a page that runs many tests keeps only
 * the values that its recent tests used.
 */
export function useCached<K, V>(cache: Map<K, V>, options: {
    readonly key: K;
    readonly limit: number;
    readonly create: () => V;
    readonly release: (value: V) => void;
}): V {
    const { key } = options;
    const cached = cache.get(key);
    if (cached !== undefined || cache.has(key)) {
        // Moves the key to the end, which Map keeps in order of insertion
        cache.delete(key);
        cache.set(key, cached as V);
        return cached as V;
    }
    const value = options.create();
    cache.set(key, value);
    while (cache.size > options.limit) {
        const [oldestKey, oldest] = cache.entries().next().value as [K, V];
        cache.delete(oldestKey);
        options.release(oldest);
    }
    return value;
}
