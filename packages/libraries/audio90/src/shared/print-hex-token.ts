// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** A hex token as a pattern writes it, such as `v9` or `P40`. */
export function printHexToken(prefix: string, value: number, digits: number): string {
    return prefix + value.toString(16).toUpperCase().padStart(digits, '0');
}
