// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Splits a pattern's row into the text of its cells. A row starts with `|`,
 * as each of its cells does. Throws an error that starts with `where` if the
 * row does not.
 */
export function splitCells(row: string, where: string): string[] {
    if (!row.startsWith('|')) throw new Error(`${where}: a row starts with |`);
    // Dropping the row's first `|` leaves the cells between the rest
    return row.slice(1).split('|');
}
