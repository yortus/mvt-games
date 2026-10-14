// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** One line of a highscore table. */
export interface HighscoreRow {
    readonly initials: string;
    readonly score: number;
    /** When it was entered, in milliseconds since the epoch. */
    readonly at: number;
}

/** How many rows a table keeps. */
export const TABLE_SIZE = 10;

/**
 * Where `score` would place in `table`, which is best first: 1 for the top,
 * or `undefined` if it would not place. A score must beat another to rank
 * above it, so a tie ranks below the score already there, as on a cabinet.
 */
export function findRank(table: readonly HighscoreRow[], score: number): number | undefined {
    let rank = 1;
    while (rank <= table.length && table[rank - 1].score >= score) rank++;
    return rank <= TABLE_SIZE ? rank : undefined;
}

/**
 * Enters `row` in `table`, which is best first: the new table, with the row
 * at its rank and anything past the last place dropped, and the rank. A row
 * that does not place leaves the table as it was, and has no rank.
 */
export function enterRow(table: readonly HighscoreRow[], row: HighscoreRow): EnteredRow {
    const rank = findRank(table, row.score);
    if (rank === undefined) return { table, rank };
    const entered = [...table.slice(0, rank - 1), row, ...table.slice(rank - 1)];
    entered.length = Math.min(entered.length, TABLE_SIZE);
    return { table: entered, rank };
}

/** A table after a row was entered in it, and where the row placed. */
export interface EnteredRow {
    readonly table: readonly HighscoreRow[];
    /** 1 for the top; `undefined` if the row did not place. */
    readonly rank: number | undefined;
}
