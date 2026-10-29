import type { AST, Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The three ways to make a watch, which the watch rules look for. */
export type WatchFactoryKind = 'watch' | 'createReaction' | 'createComputed';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Finds the names a file imports `watch`, `createReaction` and
 * `createComputed` by, from `@mvtjs/utils` or, in the library's own files, by
 * a relative path. The rules look for those names only, so they leave alone
 * another function that shares a name, such as Node's `watch`.
 */
export function collectWatchFactories(program: AST.Program): ReadonlyMap<string, WatchFactoryKind> {
    const factories = new Map<string, WatchFactoryKind>();
    for (let i = 0; i < program.body.length; i++) {
        const statement = program.body[i];
        if (statement.type !== 'ImportDeclaration' || !isWatchModule(statement.source.value)) continue;
        for (let j = 0; j < statement.specifiers.length; j++) {
            const specifier = statement.specifiers[j];
            if (specifier.type !== 'ImportSpecifier') continue;
            const imported = specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value;
            if (typeof imported === 'string' && FACTORY_KINDS.has(imported)) {
                factories.set(specifier.local.name, imported as WatchFactoryKind);
            }
        }
    }
    return factories;
}

/** Which factory a call makes a watch with, if it's a call of one. */
export function findWatchFactory(node: Rule.Node, factories: ReadonlyMap<string, WatchFactoryKind>): WatchFactoryKind | undefined {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') return undefined;
    return factories.get(node.callee.name);
}

/** Whether a node is a call of a watcher's `poll()`, such as `watcher.poll()`. */
export function isPollCall(node: Rule.Node): boolean {
    if (node.type !== 'CallExpression' || node.arguments.length > 0) return false;
    const callee = node.callee;
    return callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier' && callee.property.name === 'poll';
}

/**
 * The function a node is in, whose body is one step's code to these rules,
 * or the program, for a node outside every function.
 */
export function findEnclosingFunction(node: Rule.Node): Rule.Node {
    let current = node;
    // The root's parent is `null` in ESLint's tree, so the walk tests truthiness
    while (current.parent) {
        current = current.parent;
        if (FUNCTIONS.has(current.type)) return current;
    }
    return current;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const FACTORY_KINDS: ReadonlySet<string> = new Set(['watch', 'createReaction', 'createComputed']);

/** Whether an import's path is where the watch factories come from. */
function isWatchModule(path: unknown): boolean {
    return typeof path === 'string' && (path === '@mvtjs/utils' || path.startsWith('.'));
}

const FUNCTIONS: ReadonlySet<string> = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
