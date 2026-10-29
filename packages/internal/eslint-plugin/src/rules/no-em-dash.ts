import type { AST, Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * No em-dashes in comments, strings, template literals or JSX text: this repo
 * writes a hyphen instead. Fixable: each em-dash becomes a hyphen. One written
 * as an escape sequence in a string is code, not prose, and is left alone.
 */
export const noEmDash: Rule.RuleModule = {
    meta: {
        type: 'layout',
        docs: { description: 'Disallow em-dashes in comments, strings and JSX text; write a hyphen' },
        fixable: 'code',
        schema: [],
        messages: { emDash: 'Write a hyphen, not an em-dash.' },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const text = sourceCode.text;
        return {
            Program: () => {
                const comments = sourceCode.getAllComments();
                for (let i = 0; i < comments.length; i++) {
                    const range = comments[i].range;
                    if (range !== undefined) check(range);
                }
            },
            Literal: (node) => {
                if (typeof node.value === 'string' && node.range !== undefined) check(node.range);
            },
            TemplateElement: (node) => {
                if (node.range !== undefined) check(node.range);
            },
            JSXText: (node: Rule.Node) => {
                if (node.range !== undefined) check(node.range);
            },
        };

        function check(range: AST.Range): void {
            for (let i = range[0]; i < range[1]; i++) {
                if (text.charCodeAt(i) !== EM_DASH) continue;
                context.report({
                    loc: { start: sourceCode.getLocFromIndex(i), end: sourceCode.getLocFromIndex(i + 1) },
                    messageId: 'emDash',
                    fix: (fixer) => fixer.replaceTextRange([i, i + 1], '-'),
                });
            }
        }
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const EM_DASH = 0x2014;
