// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Throws an `Error` with `message` if `condition` is falsy: a precondition,
 * postcondition or invariant stated as code. TypeScript narrows on it, as on
 * any `asserts` function, so after `assert(slot !== undefined, ...)` the
 * compiler knows `slot` is defined.
 *
 * ```ts
 * assert(loaded, 'load() must be called before start()');
 * assert(cols > 0, () => `cols must be positive, not ${cols}`);
 * ```
 *
 * Pass a message built from values as a function, so it is built only on
 * failure. Keep it off hot paths: in code that runs every frame, write a
 * plain `if` and `throw`, which costs only the condition.
 *
 * It always checks. A check too costly to leave in a production build goes
 * under the caller's own dev-only guard (`if (DEV) assert(...)`).
 */
export function assert(condition: unknown, message: string | (() => string)): asserts condition {
    if (condition) return;
    throw new Error(typeof message === 'string' ? message : message());
}
