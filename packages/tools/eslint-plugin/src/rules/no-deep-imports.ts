import type { Rule } from 'eslint';
import { existsSync, readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { dirname, join } from 'node:path';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * Reports imports that reach past a module's entry point into its files.
 *
 * - A relative import names a file in its own folder (`./foo`) or a folder
 *   (`../models`), whose `index.ts` is its barrel. A path past a folder
 *   (`../models/ship-model`) is reported. With `allowIndexFile`, a path to a
 *   folder's index file by its full name (`./scripts/index.ts`) is allowed,
 *   for files that Node loads itself, which imports files, not folders.
 * - A package's `exports` field says which of its paths are entry points, and
 *   TypeScript and the bundler already refuse the rest. A package without an
 *   `exports` field has no such list, so only its name is allowed: `lz-string`,
 *   not `lz-string/libs/lz-string.js`.
 *
 * Subpath imports (`#shared`) are checked by TypeScript against the
 * package's `imports` field, and Node's own modules (`fs/promises`) are
 * skipped. A package that cannot be found is left to the tools that resolve
 * imports.
 */
export const noDeepImports: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow imports that reach past a folder\'s index.ts, or into a package without an `exports` field' },
        schema: [
            {
                type: 'object',
                properties: { allowIndexFile: { type: 'boolean' } },
                additionalProperties: false,
            },
        ],
        messages: {
            pastBarrel: 'Import `{{path}}` through its folder\'s index.ts, not past it. See the project structure guide, "Barrel Files".',
            intoPackage: '`{{name}}` has no `exports` field, so import it by its name only, not `{{path}}`.',
        },
    },
    create(context) {
        const options = (context.options[0] ?? {}) as { allowIndexFile?: boolean };
        const allowIndexFile = options.allowIndexFile ?? false;

        // `source` is an import's path, a string literal, which the report
        // points at. ESLint gives every node its parent, so it is a `Rule.Node`.
        const check = (source: PathNode): void => {
            const path = source.value;
            if (typeof path !== 'string') return;
            const node = source as unknown as Rule.Node;
            if (path.startsWith('./') || path.startsWith('../')) {
                if (reachesPastFolder(path, allowIndexFile)) {
                    context.report({ node, messageId: 'pastBarrel', data: { path } });
                }
                return;
            }
            if (path.startsWith('#') || path.startsWith('/') || isBuiltin(path)) return;
            const name = packageNameOf(path);
            if (name === path) return;
            if (hasExportsField(name, dirname(context.filename)) === false) {
                context.report({ node, messageId: 'intoPackage', data: { name, path } });
            }
        };

        return {
            'ImportDeclaration': (node: Rule.Node) => {
                if (node.type === 'ImportDeclaration') check(node.source);
            },
            'ExportNamedDeclaration, ExportAllDeclaration': (node: Rule.Node) => {
                if (node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportAllDeclaration') return;
                if (node.source) check(node.source);
            },
            'ImportExpression': (node: Rule.Node) => {
                if (node.type === 'ImportExpression' && node.source.type === 'Literal') check(node.source);
            },
            // A type imported inline, `import('../models/ship-model').ShipModel`.
            'TSImportType': (node: Rule.Node) => {
                check((node as unknown as TSImportType).source);
            },
        };
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The part of an import's path node that the rule reads: a string literal's value. */
interface PathNode {
    readonly value?: unknown;
}

/** The part of typescript-eslint's `TSImportType` node that the rule reads. */
interface TSImportType {
    readonly source: PathNode;
}

/**
 * Whether a relative path names something inside a folder, after its leading
 * `./` and `../` steps: `../models/ship-model` does, `../models` does not.
 */
function reachesPastFolder(path: string, allowIndexFile: boolean): boolean {
    const steps = path.split('/');
    let first = 0;
    while (first < steps.length && (steps[first] === '.' || steps[first] === '..')) first++;
    const rest = steps.length - first;
    if (rest <= 1) return false;
    return !(allowIndexFile && rest === 2 && /^index\.[a-z]+$/.test(steps[first + 1]));
}

/** The package that a bare import names: `gsap` for `gsap/dist/gsap.js`, `@scope/name` for a scoped package. */
function packageNameOf(path: string): string {
    const steps = path.split('/');
    return path.startsWith('@') ? steps.slice(0, 2).join('/') : steps[0];
}

/**
 * Whether the package `name`, as Node would find it from `fromDir`, has an
 * `exports` field. `undefined` when no `node_modules` above `fromDir` has it.
 */
function hasExportsField(name: string, fromDir: string): boolean | undefined {
    let dir = fromDir;
    for (;;) {
        const manifest = join(dir, 'node_modules', name, 'package.json');
        if (existsSync(manifest)) {
            const json = JSON.parse(readFileSync(manifest, 'utf8')) as { exports?: unknown };
            return json.exports !== undefined;
        }
        const parent = dirname(dir);
        if (parent === dir) return undefined;
        dir = parent;
    }
}
