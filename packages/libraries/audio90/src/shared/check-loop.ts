// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Checks a song's loop point, and returns it, or -1 for a song that plays once. */
export function checkLoop(loop: number | undefined, orderLength: number): number {
    const at = loop ?? -1;
    if (at !== -1 && (at < 0 || at >= orderLength || at !== Math.floor(at))) {
        throw new Error(`song: loop ${at} is not an index into its order (0 to ${orderLength - 1})`);
    }
    return at;
}
