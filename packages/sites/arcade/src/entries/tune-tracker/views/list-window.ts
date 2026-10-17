// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The first entry a list of `lineCount` lines shows, so that entry `index`
 * of `count` is in view: in the middle when it can be, and the list never
 * shows past its ends.
 */
export function computeListStart(index: number, count: number, lineCount: number): number {
    return Math.max(0, Math.min(index - Math.floor(lineCount / 2), count - lineCount));
}
