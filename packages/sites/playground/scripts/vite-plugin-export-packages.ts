import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { EXPORT_DEPENDENCIES, EXPORT_DEV_DEPENDENCIES } from '../libraries';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Provides `virtual:export-packages`, whose `EXPORT_PACKAGES` gives the
 * version of each package an exported project depends on, and whether it is
 * private, read from its `package.json` in `node_modules` as Vite starts.
 * So an export asks for the versions the playground runs.
 */
export function exportPackagesPlugin(): Plugin {
    let root = '';
    return {
        name: 'playground-export-packages',

        configResolved(config) {
            root = config.root;
        },

        resolveId(id) {
            return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
        },

        load(id) {
            if (id !== RESOLVED_ID) return undefined;
            const packages: Record<string, { version: string; isPrivate: boolean }> = {};
            for (const name of [...EXPORT_DEPENDENCIES, ...EXPORT_DEV_DEPENDENCIES]) {
                const json = JSON.parse(readFileSync(findPackageJson(root, name), 'utf8')) as { version: string; private?: boolean };
                packages[name] = { version: json.version, isPrivate: json.private === true };
            }
            return `export const EXPORT_PACKAGES = ${JSON.stringify(packages)};\n`;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const VIRTUAL_ID = 'virtual:export-packages';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/** A package's package.json, found as Node finds a package: in the nearest `node_modules` up from a folder. */
function findPackageJson(from: string, name: string): string {
    for (let dir = from; ; dir = dirname(dir)) {
        const path = join(dir, 'node_modules', name, 'package.json');
        if (existsSync(path)) return path;
        if (dirname(dir) === dir) throw new Error(`Cannot find ${name} in node_modules, up from ${from}`);
    }
}
