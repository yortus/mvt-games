import type { Plugin } from 'vite';
import { TYPE_BUNDLE_KINDS, type TypeBundleKind } from '../libraries';
import { hashBundle, makeTypeBundles, type TypeBundle } from './type-bundles';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Provides `virtual:library-types`, whose `TYPE_BUNDLE_URLS` give the URL of
 * each type bundle the editor's language service loads. In development, the
 * dev server makes the bundles on the first request, and serves them from
 * memory. In a build, each is an asset with a hashed name, beside the
 * language service's worker. Either way, the bundles come from the
 * libraries' sources and `node_modules` as they are when the bundles are made.
 */
export function libraryTypesPlugin(): Plugin {
    let isBuild = false;
    let bundles: Record<TypeBundleKind, TypeBundle> | undefined;
    const getBundles = (): Record<TypeBundleKind, TypeBundle> => (bundles ??= makeTypeBundles());

    return {
        name: 'playground-library-types',

        configResolved(config) {
            isBuild = config.command === 'build';
        },

        resolveId(id) {
            return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
        },

        load(id) {
            if (id !== RESOLVED_ID) return undefined;
            if (!isBuild) {
                const urls = TYPE_BUNDLE_KINDS.map((kind) => `${JSON.stringify(kind)}: import.meta.env.BASE_URL + ${JSON.stringify(`${DEV_PATH}${kind}.json`)}`);
                return `export const TYPE_BUNDLE_URLS = { ${urls.join(', ')} };\n`;
            }
            const urls: string[] = [];
            for (const kind of TYPE_BUNDLE_KINDS) {
                const bundle = getBundles()[kind];
                const fileName = `types-${kind}-${hashBundle(bundle)}.json`;
                this.emitFile({ type: 'asset', fileName: `assets/${fileName}`, source: JSON.stringify(bundle) });
                // Beside the worker, which is in assets/ too. Split, so Vite does not look for the file in the source
                urls.push(`${JSON.stringify(kind)}: new URL('./' + ${JSON.stringify(fileName)}, import.meta.url).href`);
            }
            return `export const TYPE_BUNDLE_URLS = { ${urls.join(', ')} };\n`;
        },

        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const match = /\/@library-types\/([a-z]+)\.json$/.exec(req.url ?? '');
                const kind = match?.[1] as TypeBundleKind | undefined;
                if (kind === undefined || !(TYPE_BUNDLE_KINDS as readonly string[]).includes(kind)) {
                    next();
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
                res.end(JSON.stringify(getBundles()[kind]));
            });
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const VIRTUAL_ID = 'virtual:library-types';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
/** Where the dev server serves the bundles, under the page's base. */
const DEV_PATH = '@library-types/';
