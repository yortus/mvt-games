import { findInitialsProblem } from './initials';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the tables know of a game: its table's version, and the most it can plausibly score. */
export interface GameRules {
    /**
     * Its table's version. A change to the game's scoring that makes its old
     * table unfair bumps it, and a fresh table starts.
     */
    readonly version: number;
    /** Scores above it are refused: loose, from what the game can plausibly reach. */
    readonly maxScore: number;
}

/** Every game with a table, by game id. */
export type GameRulesTable = Readonly<Record<string, GameRules>>;

/** A score, and the initials to enter it under, for a game's table. */
export interface Submission {
    readonly gameId: string;
    readonly initials: string;
    readonly score: number;
}

/**
 * Why a submission is refused. The first three are about the submission
 * itself; the rest are about how it arrived, and only the Worker refuses
 * them.
 */
export type RefusalReason =
    | 'unknown-game'
    | 'bad-initials'
    | 'bad-score'
    | 'bad-request'
    | 'bad-origin'
    | 'too-many';

/** The submission that `findRefusal` checks, and the games it checks it against. */
export interface SubmissionCheckOptions {
    readonly submission: Submission;
    /** The games with tables. Leave it out to take any game id, with no cap on the score. */
    readonly games?: GameRulesTable;
}

/**
 * Why `submission` would be refused, if it would: a game without a table,
 * initials that break the rules, or a score that is not a whole number from
 * 1 to the game's cap.
 */
export function findRefusal(options: SubmissionCheckOptions): RefusalReason | undefined {
    const { submission: { gameId, initials, score }, games } = options;
    const game = games === undefined ? undefined : findGameRules(games, gameId);
    if (games !== undefined && game === undefined) return 'unknown-game';
    if (findInitialsProblem(initials) !== undefined) return 'bad-initials';
    if (!Number.isSafeInteger(score) || score < 1 || score > (game?.maxScore ?? Number.MAX_SAFE_INTEGER)) return 'bad-score';
    return undefined;
}

/** The rules for the game with `gameId`, if it has a table. */
export function findGameRules(games: GameRulesTable, gameId: string): GameRules | undefined {
    return Object.hasOwn(games, gameId) ? games[gameId] : undefined;
}
