import type { Rule } from 'eslint';
import { collectWatchFactories, findWatchFactory, type WatchFactoryKind } from './watch-calls';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * Nothing is made and used in one expression: `watch(x).poll()`,
 * `createReaction({...})()`, `createComputed({...})()` or
 * `createComputed({...}).version`. Each makes a fresh watch every time it
 * runs, and a fresh watch reads its baseline as it's made. So a watcher or a
 * reaction made that way never sees a change, and a computed value never
 * caches.
 */
export const noInlineWatch: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow making a watcher, reaction or computed value and using it in one expression' },
        schema: [],
        messages: {
            inline: 'This `{{name}}(...)` is made and used in one expression, so it is made again each time it runs, and '
                + '{{consequence}}. Make it once, when the view or model is made, and keep it in a variable.',
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
                if (kind === undefined) return;
                const parent = node.parent;
                const isUsed = (parent.type === 'CallExpression' && parent.callee === node)
                    || (parent.type === 'MemberExpression' && parent.object === node);
                if (!isUsed) return;
                const consequence = kind === 'createComputed' ? 'never caches' : 'never sees a change';
                context.report({ node, messageId: 'inline', data: { name: kind, consequence } });
            },
        };
    },
};
