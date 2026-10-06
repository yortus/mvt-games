/**
 * Vite plugin providing `virtual:entry-facts`: each entry's size and
 * renderers, measured from its source when the module is loaded (see
 * `entry-facts.ts`), so the figures the arcade shows are never stale and
 * nobody keeps them by hand. On the dev server, the module is measured again
 * whenever an entry's source changes.
 */

import { resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { ENTRIES_DIR, readEntryFacts } from './entry-facts';

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function entryFactsPlugin(): Plugin {
    const srcDir = resolve(import.meta.dirname, '..', 'src');
    const repoDir = resolve(import.meta.dirname, '..', '..', '..');
    const entriesDir = resolve(srcDir, ENTRIES_DIR) + sep;

    return {
        name: 'entry-facts',
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
