// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Splits a cell or a step row into tokens, which are the words between spaces. */
export function splitTokens(text: string): string[] {
    const trimmed = text.trim();
    return trimmed === '' ? [] : trimmed.split(/\s+/);
}
