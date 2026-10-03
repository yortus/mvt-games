import type { Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * Our own code and APIs never introduce `null`; they use `undefined`, as
 * JavaScript's own APIs do. `null` still arrives from third-party APIs (the
 * DOM, Pixi, three.js), and where it does, the code is explicit about it.
 * So, if our code never creates a `null`, every `null` it meets came from
 * outside, and the rule follows from where `null` is written:
 *
 * - Compared (`node.parent === null`): checking a third-party value. Allowed.
 * - As a value (`= null`, `return null`, `f(null)`): our code creating one.
 *   Reported.
 * - In a type inside a function body (a local variable, a cast): holding a
 *   third-party value where it arrives. Allowed.
 * - In any other type (an interface, a type alias, a function's parameters
 *   or return type, a module-level variable): our API passing `null` on.
 *   Reported.
 *
 * A declaration that has to accept `null` from outside, or a third-party
 * call that needs a `null` argument, disables the rule on that line, saying
 * why.
 */
export const noNull: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: { description: 'Disallow `null` in our own code and APIs; use `undefined`' },
        schema: [],
        messages: {
            value: 'Use `undefined`, not `null`: our code does not create `null`. See the style guide, "No `null`".',
            type: 'Use `undefined` in this type, not `null`: our own APIs do not pass `null` on. Convert a third-party '
                + '`null` where it arrives (`?? undefined`). See the style guide, "No `null`".',
        },
    },
    create(context) {
        return {
            Literal: (node) => {
                if (node.raw !== 'null' || isComparison(node)) return;
                context.report({ node, messageId: 'value' });
            },
            TSNullKeyword: (node: Rule.Node) => {
                if (isInsideFunctionBody(node)) return;
                context.report({ node, messageId: 'type' });
            },
        };
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const COMPARISONS: ReadonlySet<string> = new Set(['===', '!==', '==', '!=']);

const FUNCTIONS: ReadonlySet<string> = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/** A node as the walk up the tree sees it, whatever its kind. */
interface AnyNode {
    readonly type: string;
    readonly parent?: AnyNode;
    readonly body?: unknown;
}

/** Whether `node` is one side of an equality comparison, such as `x === null`. */
function isComparison(node: Rule.Node): boolean {
    const parent = node.parent;
    if (!parent || parent.type !== 'BinaryExpression') return false;
    return COMPARISONS.has(parent.operator);
}

/**
 * Whether `node` is within some function's body, rather than in a
 * declaration's signature or at module level. A function's own parameters and
 * return type are its signature, so they are outside its body.
 */
function isInsideFunctionBody(node: Rule.Node): boolean {
    let child = node as unknown as AnyNode;
    // The root's parent is `null` in ESLint's tree, so the walk tests truthiness
    for (let parent = child.parent; parent; parent = parent.parent) {
        if (FUNCTIONS.has(parent.type) && parent.body === child) return true;
        child = parent;
    }
    return false;
}
