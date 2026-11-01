// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Wraps `fn` so it runs only when handed a different object from last time,
 * compared by reference: for an object the model replaces rather than changes
 * in place, such as a spin's wins. `createComputed` watches only primitives,
 * so it can't do this. Create one per value followed, and call it every
 * frame.
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
