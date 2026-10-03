import type { Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * No `this`: this repo's functions close over their state instead, so they
 * can be destructured, passed as callbacks and composed. Code that has no
 * other way to reach its instance, such as a method wrapped onto a library's
 * prototype, turns the rule off for its file, saying why.
 */
export const noThis: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: { description: 'Disallow `this`; close over state instead' },
        schema: [],
        messages: { this: 'Avoid `this`: close over state instead. See the style guide, "No `this`".' },
    },
    create(context) {
        return {
            ThisExpression: (node) => {
                context.report({ node, messageId: 'this' });
            },
        };
    },
};
