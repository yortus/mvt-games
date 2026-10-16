import {
    findGameRules, findRefusal, type GameRulesTable, type HighscoreRow, parseSubmitRequest, type RefusalReason,
    type RefusalResponse, STATUS_FOR_REFUSAL, type SubmitResponse, TABLES_PATH, type TablesResponse,
} from '#highscores';
import { toTableKey, type TableStorage } from './table-storage';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What the Worker's request handler works with. */
export interface RequestHandlerOptions {
    readonly storage: TableStorage;
    /** The games with tables. */
    readonly games: GameRulesTable;
    /**
     * The pages that may post scores: origins as a browser sends them
     * (`https://yortus.github.io`), or ending `:*` for any port
     * (`http://localhost:*`).
     */
    readonly allowedOrigins: readonly string[];
    /** Whether the address a post came from may post now: the rate limit. Defaults to always. */
    readonly mayPost?: (address: string) => Promise<boolean>;
    /** The secret the route that removes a row needs. Without one, the route is closed. */
    readonly adminToken?: string;
    /** The time a score is entered at, in milliseconds since the epoch. Defaults to `Date.now`. */
    readonly now?: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the function that answers the Worker's requests. It keeps its
 * tables in `storage`, and answers these requests.
 *
 * - `GET /v1/tables` returns every game's table, to any page.
 * - `POST /v1/tables/:gameId` enters a score. The post must come from an
 *   allowed page, within the rate limit, and pass `findRefusal`.
 * - `DELETE /v1/tables/:gameId/:rank` removes a row. It needs the admin
 *   token, as `Authorization: Bearer ...`.
 * - `OPTIONS` answers the browser's preflight check before a post.
 */
export function createRequestHandler(options: RequestHandlerOptions): (request: Request) => Promise<Response> {
    const { storage, games, allowedOrigins, mayPost = async () => true, adminToken, now = Date.now } = options;

    return async (request) => {
        const origin = request.headers.get('Origin') ?? undefined;
        const isAllowed = origin !== undefined && isAllowedOrigin(origin);
        const route = findRoute(new URL(request.url).pathname);
        const method = request.method;
        let response: Response;
        if (method === 'OPTIONS') response = createPreflightResponse();
        else if (route?.kind === 'tables' && method === 'GET') response = tables();
        else if (route?.kind === 'table' && method === 'POST') response = await submit(request, route.gameId, isAllowed);
        else if (route?.kind === 'row' && method === 'DELETE') response = remove(request, route.gameId, route.rank);
        else response = Response.json({ message: 'Not found' }, { status: 404 });

        // Anyone may read; only the allowed pages may post
        if (isAllowed) response.headers.set('Access-Control-Allow-Origin', origin);
        else if (method === 'GET') response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Vary', 'Origin');
        return response;
    };

    function tables(): Response {
        const body: Record<string, readonly HighscoreRow[]> = {};
        for (const [gameId, game] of Object.entries(games)) {
            const table = storage.tableAt(toTableKey(gameId, game.version));
            if (table.length > 0) body[gameId] = table;
        }
        const sent: TablesResponse = { tables: body };
        // Never stale: a visitor who has just placed must see their row
        return Response.json(sent, { headers: { 'Cache-Control': 'no-store' } });
    }

    async function submit(request: Request, gameId: string, isAllowed: boolean): Promise<Response> {
        if (!isAllowed) return createRefusal('bad-origin');
        const address = request.headers.get('CF-Connecting-IP') ?? 'unknown';
        if (!await mayPost(address)) return createRefusal('too-many');
        const text = await request.text();
        if (text.length > MAX_BODY_LENGTH) return createRefusal('bad-request', 'The request is too long');
        const body = parseSubmitRequest(parseJson(text));
        if (body === undefined) return createRefusal('bad-request', 'Expected JSON: { initials, score }');
        const game = findGameRules(games, gameId);
        if (game === undefined) return createRefusal('unknown-game');
        const reason = findRefusal({ submission: { gameId, initials: body.initials, score: body.score }, games });
        if (reason !== undefined) return createRefusal(reason);
        const entered = storage.enter(toTableKey(gameId, game.version), { initials: body.initials, score: body.score, at: now() });
        const sent: SubmitResponse = entered.rank === undefined ? { table: entered.table } : { table: entered.table, rank: entered.rank };
        return Response.json(sent);
    }

    function remove(request: Request, gameId: string, rank: number): Response {
        if (adminToken === undefined || !isToken(request.headers.get('Authorization') ?? '', `Bearer ${adminToken}`)) {
            return Response.json({ message: 'Forbidden' }, { status: 403 });
        }
        const game = findGameRules(games, gameId);
        if (game === undefined || !storage.removeAt(toTableKey(gameId, game.version), rank)) {
            return Response.json({ message: 'No such row' }, { status: 404 });
        }
        return new Response(undefined, { status: 204 });
    }

    function isAllowedOrigin(origin: string): boolean {
        for (const allowed of allowedOrigins) {
            if (origin === allowed) return true;
            if (allowed.endsWith(':*') && ANY_PORT.test(origin.slice(allowed.length - 2)) && origin.startsWith(allowed.slice(0, -2))) {
                return true;
            }
        }
        return false;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Route =
    | { readonly kind: 'tables' }
    | { readonly kind: 'table'; readonly gameId: string }
    | { readonly kind: 'row'; readonly gameId: string; readonly rank: number };

/** The longest request body taken: a submission is a few dozen characters. */
const MAX_BODY_LENGTH = 1024;

/** A port, after an allowed origin ending `:*`. */
const ANY_PORT = /^:\d{1,5}$/;

const MESSAGE_FOR_REFUSAL: Readonly<Record<RefusalReason, string>> = {
    'unknown-game': 'No such game has a table',
    'bad-initials': 'Initials are three characters: A-Z, 0-9, full stop or space, not all spaces',
    'bad-score': 'A score is a whole number, from 1 to the most the game can plausibly reach',
    'bad-request': 'Bad request',
    'bad-origin': 'Scores are taken only from the Arcade',
    'too-many': 'Too many scores from one address; try again in a minute',
};

function findRoute(path: string): Route | undefined {
    if (path === TABLES_PATH) return { kind: 'tables' };
    if (!path.startsWith(`${TABLES_PATH}/`)) return undefined;
    const [encodedId, rankText, ...rest] = path.slice(TABLES_PATH.length + 1).split('/');
    const gameId = decodeSegment(encodedId);
    if (gameId === undefined || gameId === '' || rest.length > 0) return undefined;
    if (rankText === undefined) return { kind: 'table', gameId };
    if (!/^\d{1,2}$/.test(rankText)) return undefined;
    return { kind: 'row', gameId, rank: Number(rankText) };
}

function createPreflightResponse(): Response {
    return new Response(undefined, {
        status: 204,
        headers: {
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        },
    });
}

function createRefusal(reason: RefusalReason, message = MESSAGE_FOR_REFUSAL[reason]): Response {
    const sent: RefusalResponse = { refused: reason, message };
    return Response.json(sent, { status: STATUS_FOR_REFUSAL[reason] });
}

function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}

function decodeSegment(text: string): string | undefined {
    try {
        return decodeURIComponent(text);
    }
    catch {
        return undefined;
    }
}

/** Whether `given` is `expected`, taking as long to say no whichever character differs. */
function isToken(given: string, expected: string): boolean {
    if (given.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= given.charCodeAt(i) ^ expected.charCodeAt(i);
    return difference === 0;
}
