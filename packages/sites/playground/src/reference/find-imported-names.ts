import { isLibrary } from '../../libraries';
import type { ImportedName } from './reference-model';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The names that a project's files import from the libraries, each once:
 * `import { watch, type Watcher } from '@mvtjs/utils'` imports `watch` and
 * `Watcher`, and `import gsap from 'gsap'` imports `gsap`. An import of a
 * project file, or a whole module (`import * as`), names nothing.
 */
export function findImportedNames(texts: readonly string[]): ImportedName[] {
    const found: ImportedName[] = [];
    for (const text of texts) {
        for (const match of text.matchAll(IMPORT)) {
            const [, defaultName, named, from] = match;
            if (!isLibrary(from)) continue;
            const names = named === undefined ? [] : named.split(',').map(toImportedName);
            if (defaultName !== undefined) names.push(defaultName);
            for (const name of names) {
                if (name !== '' && !found.some((f) => f.name === name && f.from === from)) found.push({ name, from });
            }
        }
    }
    return found;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** An import with a default name, braces, or both: `import a, { b, c as d } from 'x'`. */
const IMPORT = /\bimport\s+(?:type\s+)?(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;

/** The name a library exports, from one part of an import's braces: `type Watcher` is `Watcher`, and `watch as w` is `watch`. */
function toImportedName(part: string): string {
    return part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
}
