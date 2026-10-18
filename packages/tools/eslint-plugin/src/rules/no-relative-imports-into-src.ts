import type { Rule } from 'eslint';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { type PathNode, visitImportSources } from './import-sources';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * Reports relative imports into a package's `src/` folder from a file outside
 * it, such as `'../src/highscores'` from a package's `scripts/` or a worker
 * beside its `src/`. Files outside `src/` import its modules by the package's
 * name, or through an `imports` mapping in its `package.json` (`#shared`).
 * Then the mapping is the one place that knows the path, and the module's
 * barrel stays its way in.
 *
 * The package is the nearest folder above the imported path with a
 * `package.json`. A file in that `src/` folder is never reported, since its
 * relative imports stay inside it.
 */
export const noRelativeImportsIntoSrc: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow relative imports into a package\'s src/ folder from a file outside it' },
        schema: [],
        messages: {
            intoSrc: 'Import `{{path}}` by its package\'s name, or through an `imports` mapping in its package.json (such as `#shared`), not by a relative path into src/ from outside it.',
        },
    },
    create(context) {
        const fromDir = dirname(context.filename);

        const check = (source: PathNode): void => {
            const path = source.value;
            if (typeof path !== 'string') return;
            if (!path.startsWith('./') && !path.startsWith('../')) return;
            const srcDir = srcFolderOf(resolve(fromDir, path));
            if (srcDir === undefined || isInside(context.filename, srcDir)) return;
            // ESLint gives every node its parent, so the literal is a `Rule.Node`.
            context.report({ node: source as unknown as Rule.Node, messageId: 'intoSrc', data: { path } });
        };

        return visitImportSources(check);
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The `src/` folder of the package that holds `target`, if `target` is in
 * it. The package is the nearest folder above `target` with a
 * `package.json`.
 */
function srcFolderOf(target: string): string | undefined {
    let dir = dirname(target);
    for (;;) {
        if (existsSync(join(dir, 'package.json'))) {
            const srcDir = join(dir, 'src');
            return target === srcDir || isInside(target, srcDir) ? srcDir : undefined;
        }
        const parent = dirname(dir);
        if (parent === dir) return undefined;
        dir = parent;
    }
}

/** Whether `path` is somewhere inside the folder `dir`. */
function isInside(path: string, dir: string): boolean {
    const steps = relative(dir, path);
    return steps !== '' && !steps.startsWith(`..${sep}`) && steps !== '..' && !steps.startsWith(sep) && !/^[a-zA-Z]:/.test(steps);
}
