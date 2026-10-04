// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Credits as every view writes them: whole numbers, with thousands separated. */
export function formatCredits(credits: number): string {
    return CREDITS.format(credits);
}

/** A way's rows as players read them, counting from 1: `1-3-2`. */
export function formatRows(rows: readonly number[]): string {
    let text = '';
    for (let i = 0; i < rows.length; i++) text += (i === 0 ? '' : '-') + (rows[i] + 1);
    return text;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CREDITS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
