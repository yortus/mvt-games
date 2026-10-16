import type { HighscoreRow, RefusalReason } from '../rules';
import { type RefusalResponse, STATUS_FOR_REFUSAL, type SubmitRequest, type SubmitResponse, type TablesResponse } from './api';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------
// Each function takes JSON as it arrived. It returns it typed, or
// `undefined` if it is not that shape. The functions check only the shape:
// whether initials or a score break the rules is for `findRefusal` to decide.

/** Returns every game's table from the answer to `GET /v1/tables`, or `undefined` if the answer is not that shape. */
export function parseTablesResponse(json: unknown): TablesResponse | undefined {
    if (!isRecord(json) || !isRecord(json.tables)) return undefined;
    const tables: Record<string, readonly HighscoreRow[]> = {};
    for (const [gameId, rows] of Object.entries(json.tables)) {
        const parsed = parseRows(rows);
        if (parsed === undefined) return undefined;
        tables[gameId] = parsed;
    }
    return { tables };
}

/** Returns the initials and score from a post's body, or `undefined` if the body is not that shape. */
export function parseSubmitRequest(json: unknown): SubmitRequest | undefined {
    if (!isRecord(json) || typeof json.initials !== 'string' || typeof json.score !== 'number') return undefined;
    return { initials: json.initials, score: json.score };
}

/** Returns the table and rank from the answer to a post, or `undefined` if the answer is not that shape. */
export function parseSubmitResponse(json: unknown): SubmitResponse | undefined {
    if (!isRecord(json)) return undefined;
    const table = parseRows(json.table);
    if (table === undefined) return undefined;
    if (json.rank === undefined) return { table };
    if (!Number.isSafeInteger(json.rank)) return undefined;
    return { table, rank: json.rank as number };
}

/** Returns why a post was refused, from the answer to it, or `undefined` if the answer is not that shape. */
export function parseRefusalResponse(json: unknown): RefusalResponse | undefined {
    if (!isRecord(json) || !isRefusalReason(json.refused)) return undefined;
    return { refused: json.refused, message: typeof json.message === 'string' ? json.message : '' };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function parseRows(json: unknown): HighscoreRow[] | undefined {
    if (!Array.isArray(json)) return undefined;
    const rows: HighscoreRow[] = [];
    for (const row of json) {
        if (!isRecord(row) || typeof row.initials !== 'string' || typeof row.score !== 'number' || typeof row.at !== 'number') {
            return undefined;
        }
        rows.push({ initials: row.initials, score: row.score, at: row.at });
    }
    return rows;
}

function isRecord(json: unknown): json is Readonly<Record<string, unknown>> {
    return typeof json === 'object' && json !== null && !Array.isArray(json);
}

function isRefusalReason(json: unknown): json is RefusalReason {
    return typeof json === 'string' && Object.hasOwn(STATUS_FOR_REFUSAL, json);
}
