import { GAMES } from '#highscores';
import { createRequestHandler } from './request-handler';
import { createSqlTableStorage } from './sql-table-storage';

// The Worker, as Cloudflare runs it (`wrangler.toml`'s `main`). Everything
// here is wiring: what it does is in `createRequestHandler`, tested in Node.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What `wrangler.toml` and the Worker's secrets give it. */
export interface HighscoresEnv {
    /** The one Durable Object that holds every table. */
    readonly HIGHSCORES: DurableObjectNamespace;
    /** A few posts a minute from one address. */
    readonly POST_LIMIT: RateLimit;
    /** The pages that may post, comma separated (see `RequestHandlerOptions.allowedOrigins`). */
    readonly ALLOWED_ORIGINS: string;
    /** The secret for removing a row, set with `wrangler secret put ADMIN_TOKEN`. Without it, nothing can be removed. */
    readonly ADMIN_TOKEN?: string;
}

/** Hands every request to the one Durable Object, so every table is in one place, and writes happen one at a time. */
export default {
    fetch(request: Request, env: HighscoresEnv): Promise<Response> {
        return env.HIGHSCORES.get(env.HIGHSCORES.idFromName(OBJECT_NAME)).fetch(request);
    },
};

/**
 * The Durable Object. The runtime calls its export with `new`; a function
 * that returns an object gives that object as the instance, so it can be a
 * factory, as everything here is, rather than a class.
 */
export function HighscoresObject(ctx: DurableObjectState, env: HighscoresEnv): { fetch: (request: Request) => Promise<Response> } {
    const sql = ctx.storage.sql;
    const handle = createRequestHandler({
        storage: createSqlTableStorage({ exec: (query, ...bindings) => sql.exec(query, ...bindings) }),
        games: GAMES,
        allowedOrigins: env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter((origin) => origin !== ''),
        mayPost: async (address) => (await env.POST_LIMIT.limit({ key: address })).success,
        adminToken: env.ADMIN_TOKEN,
    });
    return { fetch: handle };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The name of the one Durable Object. */
const OBJECT_NAME = 'arcade';
