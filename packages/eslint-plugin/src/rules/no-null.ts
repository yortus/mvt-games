import type { Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * No `null`, as a value or in a type: this repo uses `undefined`, as
 * JavaScript's own APIs do. Comparing with `null` is allowed, since that is
 * how code checks what an API such as the DOM's or Pixi's returns. Where a
 * type has to describe such an API, disable the rule on that line, saying
 * why.
 */
export const noNull: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: { description: 'Disallow `null`, except in comparisons; use `undefined`' },
        schema: [],
        messages: {
            value: 'Use `undefined`, not `null`. See the style guide, "No `null`".',
            type: 'Use `undefined` in types, not `null`, unless the type describes an API that returns `null`. '
                + 'See the style guide, "No `null`".',
        },
    },
    create(context) {
        return {
            Literal: (node) => {
                if (node.raw !== 'null' || isComparison(node)) return;
                context.report({ node, messageId: 'value' });
            },
            TSNullKeyword: (node: Rule.Node) => {
                context.report({ node, messageId: 'type' });
            },
        };
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const COMPARISONS: ReadonlySet<string> = new Set(['===', '!==', '==', '!=']);

/** Whether `node` is one side of an equality comparison, such as `x === null`. */
function isComparison(node: Rule.Node): boolean {
    const parent = node.parent;
    if (!parent || parent.type !== 'BinaryExpression') return false;
    return COMPARISONS.has(parent.operator);
}
