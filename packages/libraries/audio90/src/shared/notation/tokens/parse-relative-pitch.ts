// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** A relative pitch token's semitones (`+7`, `-12`, `+0`), or undefined if it is not one. */
export function parseRelativePitch(token: string): number | undefined {
    return RELATIVE.test(token) ? Number(token) : undefined;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const RELATIVE = /^[+-]\d{1,2}$/;
