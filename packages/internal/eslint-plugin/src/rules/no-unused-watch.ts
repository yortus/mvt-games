import type { Rule, Scope } from 'eslint';
import { collectWatchFactories, findWatchFactory, isPollCall, type WatchFactoryKind } from './watch-calls';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * Every watcher and reaction made is used. A watcher must have its `poll()`
 * called somewhere in the file, and a reaction must be called, or passed on,
 * such as to `setRefresh` or into an array. A `watch(...)` or
 * `createReaction(...)` whose result is thrown away is reported too. Each of
 * these fails silently: the sound never plays, and nothing says why.
 *
 * A watcher passed on, returned or stored in an object or array is taken as
 * used, since what polls it is elsewhere.
 */
export const noUnusedWatch: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Require every watcher to be polled, and every reaction to be called or passed on' },
        schema: [],
        messages: {
            neverPolled: 'This watcher is never polled. Call its `poll()` once in each step, or remove it.',
            neverCalled: 'This reaction is never called or passed on. Call it once in each step, or remove it.',
            discarded: 'This `{{name}}(...)` is thrown away, so it never runs. Keep it in a variable, and {{use}} once in each step.',
        },
    },
    create(context) {
        let factories: ReadonlyMap<string, WatchFactoryKind> = new Map();
        return {
            Program: (node) => {
                factories = collectWatchFactories(node);
            },
            CallExpression: (node) => {
                const kind = findWatchFactory(node, factories);
                if (kind === undefined || kind === 'createComputed') return;
                const parent = node.parent;
                if (parent.type === 'ExpressionStatement') {
                    const use = kind === 'watch' ? 'call its `poll()`' : 'call it';
                    context.report({ node, messageId: 'discarded', data: { name: kind, use } });
                    return;
                }
                if (parent.type !== 'VariableDeclarator' || parent.init !== node) return;
                const variables = context.sourceCode.getDeclaredVariables(parent);
                if (variables.length !== 1) return;
                const isUsed = kind === 'watch' ? isWatcherUsed(variables[0]) : isRead(variables[0]);
                if (!isUsed) context.report({ node: parent, messageId: kind === 'watch' ? 'neverPolled' : 'neverCalled' });
            },
        };
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Whether a watcher is polled, or passed on to something that may poll it. */
function isWatcherUsed(variable: Scope.Variable): boolean {
    for (let i = 0; i < variable.references.length; i++) {
        const reference = variable.references[i];
        if (!reference.isRead()) continue;
        const identifier = reference.identifier as Rule.Node;
        const parent = identifier.parent;
        // Anything but a member access passes the watcher on
        if (parent?.type !== 'MemberExpression' || parent.object !== identifier) return true;
        if (parent.parent && isPollCall(parent.parent)) return true;
    }
    return false;
}

function isRead(variable: Scope.Variable): boolean {
    for (let i = 0; i < variable.references.length; i++) {
        if (variable.references[i].isRead()) return true;
    }
    return false;
}
