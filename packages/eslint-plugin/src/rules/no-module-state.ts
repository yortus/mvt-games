import type { Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * Reports `let` and `var` declarations at module level, exported or not. A
 * model's state belongs in the object that its factory makes. A `let` or
 * `var` at the top of a model file is shared by every model the file makes,
 * in every game played on the same page. So one game's state leaks into the
 * next, and what a model does depends on what ran before it. For example, a
 * counter at module level once made a game's asteroid shapes depend on the
 * games played before it. The rule is meant for model files, and a config
 * applies it to them.
 */
export const noModuleState: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow `let` and `var` at module level. Keep state in the object that the factory makes.' },
        schema: [],
        messages: {
            moduleState: '`{{kind}} {{name}}` at module level is shared by every model this file makes. Keep it in the factory.',
        },
    },
    create(context) {
        return {
            'Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration': (node: Rule.Node) => {
                if (node.type !== 'VariableDeclaration' || node.kind === 'const') return;
                for (const declarator of node.declarations) {
                    const name = declarator.id.type === 'Identifier' ? declarator.id.name : '...';
                    context.report({ node: declarator, messageId: 'moduleState', data: { kind: node.kind, name } });
                }
            },
        };
    },
};
