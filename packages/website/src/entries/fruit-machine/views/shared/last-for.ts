// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * `memoiseLast` for an object argument, compared by reference: for an object
 * the model replaces rather than changes in place, such as a spin's wins.
 * Create one per value followed, and call it every frame; it runs `fn` only
 * when handed a different object from last time.
 */
export function lastFor<T extends object, R>(fn: (arg: T) => R): (arg: T) => R {
    let lastArg: T | undefined;
    let lastResult: R;
    return (arg) => {
        if (arg !== lastArg) {
            lastArg = arg;
            lastResult = fn(arg);
        }
        return lastResult;
    };
}
