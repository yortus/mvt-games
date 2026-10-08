import type { Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * No state at module level: a model's state lives in what its factory
 * makes. A `let` or `var` at the top of a model file is shared by every
 * model the file makes, in every game the page plays, so one game's state
 * leaks into the next, and what a model does depends on what ran before it
 * (as Astrovoid's asteroids' shapes once did). Reports top-level `let` and
 * `var` declarations, exported or not. Meant for model files; a config
 * applies it to them.
 */
export const noModuleState: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow `let` and `var` at module level; keep state in what the factory makes' },
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
