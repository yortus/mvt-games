import type { Rule } from 'eslint';
import { findEnclosingFunction, isPollCall } from './watch-calls';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * A watcher is polled at most once in a function body. A second poll reads
 * the same values as the first, so it always reports that nothing changed.
 * Watchers are told apart by how they're written (`watcher`,
 * `view.phaseWatcher`), and a poll in a nested function counts toward that
 * function. A reaction called twice isn't reported, since the second call is
 * harmless.
 */
export const noRepeatedPoll: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow polling one watcher twice in a function body' },
        schema: [],
        messages: {
            repeated: '`{{name}}` was already polled in this function, and a second poll always reports that nothing '
                + 'changed. Poll it once, and keep the reading for the rest of the step.',
        },
    },
    create(context) {
        const polledIn = new Map<Rule.Node, Set<string>>();
        return {
            CallExpression: (node) => {
                if (!isPollCall(node) || node.callee.type !== 'MemberExpression') return;
                const name = context.sourceCode.getText(node.callee.object);
                const scope = findEnclosingFunction(node);
                let polled = polledIn.get(scope);
                if (polled === undefined) {
                    polled = new Set();
                    polledIn.set(scope, polled);
                }
                if (polled.has(name)) context.report({ node, messageId: 'repeated', data: { name } });
                else polled.add(name);
            },
        };
    },
};
