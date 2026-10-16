import type { HighscoreRow, RefusalReason, Submission } from '../rules';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Where the Arcade's highscore tables are kept. A promise rejects only when
 * the tables cannot be reached, or answer with something unexpected. A score
 * that the tables turn down still resolves, as `'refused'`.
 */
export interface HighscoreStore {
    /** Every game's table, best first, by game id. A game with no scores yet is absent. */
    readonly loadAll: () => Promise<HighscoreTables>;
    /** Enters a score in its game's table. */
    readonly submit: (submission: Submission) => Promise<SubmitResult>;
}

/** Every game's table, best first, by game id. */
export type HighscoreTables = ReadonlyMap<string, readonly HighscoreRow[]>;

/** What became of a score. It was entered, whether or not it placed, or it was refused. */
export type SubmitResult = EnteredResult | RefusedResult;

/** A score the tables took. It may not have placed. */
export interface EnteredResult {
    readonly kind: 'entered';
    /** The game's table as it now stands, best first. */
    readonly table: readonly HighscoreRow[];
    /** Where the score placed, 1 for the top. It is `undefined` if the score did not place. */
    readonly rank: number | undefined;
}

/** A score the tables turned down. */
export interface RefusedResult {
    readonly kind: 'refused';
    /** Why the score was turned down. */
    readonly reason: RefusalReason;
}
