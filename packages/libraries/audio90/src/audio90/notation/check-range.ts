// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Returns `value` if it is a number from `min` to `max`, or throws an error that names the option at `path`. */
export function checkRange(value: number, min: number, max: number, path: string, prefix = 'sound'): number {
    if (!(value >= min && value <= max)) {
        const range = max === Infinity ? `${min} or more` : `${min} to ${max}`;
        throw new Error(`${prefix}: ${path}: ${value} is not ${range}`);
    }
    return value;
}
