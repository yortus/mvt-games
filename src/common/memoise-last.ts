// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Wraps a one-argument function so that it runs only when called with a
 * different argument from last time (compared with `===`), and otherwise
 * returns its last result. Calling it costs one comparison.
 *
 * It remembers only the last argument, hence its name, not every argument it
 * has seen: it is for a value polled every frame, which is usually the same as
 * last frame's. So create one per value followed, once, at construction, and
 * call it every frame:
 *
 * ```tsx
 * const scoreText = memoiseLast((score: number) => `SCORE ${score}`);
 * <text text={() => scoreText(bindings.score())} />
 * ```
 *
 * The argument must be a primitive. An object changed in place is still `===`
 * to itself, so the wrapped function would keep returning a stale result.
 */
export function memoiseLast<T extends string | number | boolean | bigint | symbol | null | undefined, R>(
    fn: (arg: T) => R,
): (arg: T) => R {
    let isFirst = true;
    let lastArg: T;
    let lastResult: R;
    return (arg) => {
        if (isFirst || arg !== lastArg) {
            isFirst = false;
            lastArg = arg;
            lastResult = fn(arg);
        }
        return lastResult;
    };
}
