/**
 * Vite plugin providing `virtual:entry-facts`: each entry's size and
 * renderers, measured from its source when the module is loaded (see
 * `entry-facts.ts`), so the figures the site's page shows are never stale and
 * nobody keeps them by hand. On the dev server, the module is measured again
 * whenever an entry's source changes.
 */

import { resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { ENTRIES_DIR, readEntryFacts } from './entry-facts.ts';

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function entryFactsPlugin(): Plugin {
    // The site's, from Vite's root: each site's package is three folders down from the repo's root
    let srcDir = '';
    let repoDir = '';
    let entriesDir = '';

    return {
        name: 'entry-facts',
        configResolved(config) {
            srcDir = resolve(config.root, 'src');
            repoDir = resolve(config.root, '..', '..', '..');
            entriesDir = resolve(srcDir, ENTRIES_DIR) + sep;
        },
        resolveId(id) {
            return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
        },
        load(id) {
            if (id !== RESOLVED_ID) return undefined;
            const facts = readEntryFacts({ srcDir, repoDir });
            return `export const ENTRY_FACTS = ${JSON.stringify(facts)};\n`;
        },
        configureServer(server) {
            server.watcher.on('all', (_event, path) => {
                if (!resolve(path).startsWith(entriesDir)) return;
                const module = server.moduleGraph.getModuleById(RESOLVED_ID);
                if (module !== undefined) server.moduleGraph.invalidateModule(module);
            });
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const VIRTUAL_ID = 'virtual:entry-facts';
const RESOLVED_ID = '\0' + VIRTUAL_ID;
