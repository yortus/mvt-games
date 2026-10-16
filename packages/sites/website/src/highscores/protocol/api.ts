import type { HighscoreRow, RefusalReason } from '../rules';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------
// What the browser and the Worker send each other, as JSON:
//
//   GET  /v1/tables              -> 200 TablesResponse
//   POST /v1/tables/:gameId     SubmitRequest -> 200 SubmitResponse, or 4xx RefusalResponse

/** The path of every game's tables. */
export const TABLES_PATH = '/v1/tables';

/** The path of one game's table, which a score is posted to. */
export function toTablePath(gameId: string): string {
    return `${TABLES_PATH}/${encodeURIComponent(gameId)}`;
}

/** Every game's table, best first, by game id. A game with no scores yet is absent. */
export interface TablesResponse {
    readonly tables: Readonly<Record<string, readonly HighscoreRow[]>>;
}

/** A score to enter in a game's table. */
export interface SubmitRequest {
    readonly initials: string;
    readonly score: number;
}

/** The game's table after a score was entered, best first, and where the score placed. */
export interface SubmitResponse {
    readonly table: readonly HighscoreRow[];
    /** 1 for the top. Absent if the score did not place. */
    readonly rank?: number;
}

/** Why a score was refused, as a reason to act on and a message to log. */
export interface RefusalResponse {
    readonly refused: RefusalReason;
    readonly message: string;
}

/** The HTTP status the Worker refuses with, for each reason. */
export const STATUS_FOR_REFUSAL: Readonly<Record<RefusalReason, number>> = {
    'unknown-game': 404,
    'bad-initials': 400,
    'bad-score': 400,
    'bad-request': 400,
    'bad-origin': 403,
    'too-many': 429,
};
