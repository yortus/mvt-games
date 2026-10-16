import {
    parseRefusalResponse, parseSubmitResponse, parseTablesResponse, type SubmitRequest, TABLES_PATH, toTablePath,
} from '../protocol';
import type { HighscoreStore, HighscoreTables } from './highscore-store';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a store that reaches the Worker. */
export interface FetchHighscoreStoreOptions {
    /** Where the Worker is, without a trailing slash (`https://highscores.yortus.workers.dev`). */
    readonly url: string;
    /** Makes the requests. Defaults to the global `fetch`; tests pass their own. */
    readonly fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a store that reaches the Worker's tables with `fetch`. */
export function createFetchHighscoreStore(options: FetchHighscoreStoreOptions): HighscoreStore {
    const { url } = options;
    const request = options.fetch ?? ((input, init) => fetch(input, init));

    const store: HighscoreStore = {
        async loadAll() {
            const response = await request(`${url}${TABLES_PATH}`);
            const body = response.ok ? parseTablesResponse(await readJson(response)) : undefined;
            if (body === undefined) throw createFailure(response, 'loading the tables');
            const tables: HighscoreTables = new Map(Object.entries(body.tables));
            return tables;
        },
        async submit({ gameId, initials, score }) {
            const sent: SubmitRequest = { initials, score };
            const response = await request(`${url}${toTablePath(gameId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sent),
            });
            const json = await readJson(response);
            if (response.ok) {
                const body = parseSubmitResponse(json);
                if (body !== undefined) return { kind: 'entered', table: body.table, rank: body.rank };
            }
            else {
                const refusal = parseRefusalResponse(json);
                if (refusal !== undefined) return { kind: 'refused', reason: refusal.refused };
            }
            throw createFailure(response, 'entering a score');
        },
    };
    return store;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The response's body as JSON, or `undefined` if it is not JSON. */
async function readJson(response: Response): Promise<unknown> {
    try {
        return await response.json();
    }
    catch {
        return undefined;
    }
}

function createFailure(response: Response, doing: string): Error {
    return new Error(`highscores: unexpected response ${response.status} ${response.statusText} while ${doing}`);
}
