// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A memoized getter. Returns the cached result of a computation until one or
 * more tracked dependencies change, at which point it recomputes on the next
 * call.
 *
 * Dependencies are discovered automatically during the first computation by
 * proxying the source object and recording which methods are invoked.
 *
 * ```ts
 * const getScoreText = memo(bindings, (b) => `Score: ${b.getScore()}`);
 *
 * // Hot path - returns cached string until getScore() changes
 * <text text={getScoreText} />
 * ```
 */
export type Memo<T> = () => T;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a memoized getter that recomputes only when its tracked dependencies
 * change. Dependencies are tracked automatically via a proxy around `source`.
 *
 * @param source  - Object whose methods serve as pollable getters (e.g. a
 *                  bindings interface).
 * @param compute - Pure function that receives a tracked proxy of `source`
 *                  and returns the derived value. Called once immediately to
 *                  discover dependencies and compute the initial value.
 * @returns         A no-arg getter suitable for use as a dynamic JSX prop or
 *                  anywhere a pollable value is needed.
 */
export function memo<B extends object, T>(source: B, compute: (tracked: B) => T): Memo<T> {
    const trackedGetters: (() => unknown)[] = [];
    const lastDepValues: unknown[] = [];
    const seen = new Set<string | symbol>();
    let tracking = true;
    let cachedResult: T;

    // Proxy that records which no-arg methods are called during `compute`.
    // Wrapper functions are cached per property to avoid repeated allocations
    // when compute is re-invoked.
    const wrapperCache = new Map<string | symbol, () => unknown>();

    const proxy = new Proxy(source, {
        get(target, prop) {
            const original = Reflect.get(target, prop);
            if (typeof original !== 'function') return original;

            let wrapper = wrapperCache.get(prop);
            if (wrapper) return wrapper;

            const fn = original as () => unknown;
            wrapper = () => {
                const result = fn.call(target);
                if (tracking && !seen.has(prop)) {
                    seen.add(prop);
                    trackedGetters.push(() => fn.call(target));
                    lastDepValues.push(result);
                }
                return result;
            };
            wrapperCache.set(prop, wrapper);
            return wrapper;
        },
    });

    // Initial computation - discovers dependencies and seeds cached result.
    cachedResult = compute(proxy as B);
    tracking = false;

    // Returned getter: poll deps (hot path), recompute only on change.
    return () => {
        let changed = false;
        for (let i = 0; i < trackedGetters.length; i++) {
            const next = trackedGetters[i]();
            if (next !== lastDepValues[i]) {
                lastDepValues[i] = next;
                changed = true;
            }
        }
        if (changed) {
            cachedResult = compute(proxy as B);
        }
        return cachedResult;
    };
}
