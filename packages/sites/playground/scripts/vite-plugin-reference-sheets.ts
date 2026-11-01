import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
import { CHEAT_SHEETS, LEFT_OUT } from '../cheat-sheets';
import { type MadeReferenceSheets, makeReferenceSheets } from './make-reference-sheets';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Provides `virtual:reference-sheets`, whose `REFERENCE_SHEETS_URL` is the
 * URL of the reference sheets as JSON: the cheat sheets with every entry's
 * signature and summary filled in. The page fetches them the first time the
 * cheat sheet opens. In development, the dev server makes them on the first
 * request, and serves them from memory. A change to a sheet restarts the
 * server, since this config imports the sheets. In a build, they're an asset
 * with a hashed name. Either way, a problem with the sheets, such as a name a
 * library doesn't export, is logged as a warning, and the sheets' test fails
 * on it.
 */
export function referenceSheetsPlugin(): Plugin {
    let isBuild = false;
    let made: MadeReferenceSheets | undefined;
    const getMade = (warn: (message: string) => void): MadeReferenceSheets => {
        if (made === undefined) {
            made = makeReferenceSheets({ sheets: CHEAT_SHEETS, leftOut: LEFT_OUT });
            for (const problem of made.problems) warn(`Cheat sheets: ${problem}`);
        }
        return made;
    };

    return {
        name: 'playground-reference-sheets',

        configResolved(config) {
            isBuild = config.command === 'build';
        },

        resolveId(id) {
            return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
        },

        load(id) {
            if (id !== RESOLVED_ID) return undefined;
            if (!isBuild) return `export const REFERENCE_SHEETS_URL = import.meta.env.BASE_URL + ${JSON.stringify(DEV_PATH)};\n`;
            const json = JSON.stringify(getMade((message) => this.warn(message)).sheets);
            const fileName = `assets/reference-sheets-${createHash('sha256').update(json).digest('hex').slice(0, 10)}.json`;
            this.emitFile({ type: 'asset', fileName, source: json });
            return `export const REFERENCE_SHEETS_URL = import.meta.env.BASE_URL + ${JSON.stringify(fileName)};\n`;
        },

        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (!(req.url ?? '').endsWith(`/${DEV_PATH}`)) {
                    next();
                    return;
                }
                const { sheets } = getMade((message) => server.config.logger.warn(message));
                res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
                res.end(JSON.stringify(sheets));
            });
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const VIRTUAL_ID = 'virtual:reference-sheets';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
/** Where the dev server serves the sheets, under the page's base. */
const DEV_PATH = '@reference-sheets.json';
