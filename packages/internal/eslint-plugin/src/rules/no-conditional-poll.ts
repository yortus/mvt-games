import type { Rule, Scope, SourceCode } from 'eslint';
import { collectWatchFactories, findWatchFactory, isPollCall, type WatchFactoryKind } from './watch-calls';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * A watcher's `poll()`, and a call of a reaction made in the file, run on
 * every step: not inside an `if`, a `switch`, a ternary, `&&`, `||` or `??`,
 * and not after an early `return` in their function. A watch compares each
 * read with its last one, so a read skipped on some steps compares with an
 * older read, and can miss a change that came and went in between.
 *
 * A poll in an `if`'s condition runs on every step, so it isn't reported. A
 * gap someone intends, such as a step that stops at game over, takes an
 * `eslint-disable` comment saying why.
 */
export const noConditionalPoll: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Require polls and reaction calls to run on every step, unconditionally' },
        schema: [],
        messages: {
            conditional: 'This {{what}} runs only on some steps, so it compares with an older read and can miss a '
                + 'change. Run it on every step, before any condition. If the gap is intended, disable this rule '
                + 'here, saying why.',
            afterReturn: 'This {{what}} comes after an early `return`, so it runs only on some steps, compares with '
                + 'an older read, and can miss a change. Run it before the `return`. If the gap is intended, disable '
                + 'this rule here, saying why.',
        },
    },
    create(context) {
        let factories: ReadonlyMap<string, WatchFactoryKind> = new Map();
        const reactions: Scope.Variable[] = [];
        return {
            'Program': (node) => {
                factories = collectWatchFactories(node);
            },
            'CallExpression': (node) => {
                if (isPollCall(node)) {
                    check(node, 'poll');
                    return;
                }
                const parent = node.parent;
                if (findWatchFactory(node, factories) !== 'createReaction') return;
                if (parent.type !== 'VariableDeclarator' || parent.init !== node) return;
                reactions.push(...context.sourceCode.getDeclaredVariables(parent));
            },
            // Reactions are often called above where they're made in the file, in a function declared lower
            // down, so their calls are checked once every reaction is known
            'Program:exit': () => {
                for (let i = 0; i < reactions.length; i++) {
                    const references = reactions[i].references;
                    for (let j = 0; j < references.length; j++) {
                        const identifier = references[j].identifier as Rule.Node;
                        const parent = identifier.parent;
                        if (parent?.type === 'CallExpression' && parent.callee === identifier) check(parent, 'reaction call');
                    }
                }
            },
        };

        function check(call: Rule.Node, what: string): void {
            const gap = findGap(call, context.sourceCode.visitorKeys);
            if (gap !== undefined) context.report({ node: call, messageId: gap, data: { what } });
        }
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type GapKind = 'conditional' | 'afterReturn';

const FUNCTIONS: ReadonlySet<string> = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/** A node as the walks see it, whatever its kind. */
interface AnyNode {
    readonly type: string;
    readonly parent?: AnyNode;
    readonly [key: string]: unknown;
}

/**
 * Whether something in `call`'s function can skip it: a condition around it,
 * or a `return` in a statement before it, in any block between it and the
 * function.
 */
function findGap(call: Rule.Node, visitorKeys: SourceCode.VisitorKeys): GapKind | undefined {
    let child = call as unknown as AnyNode;
    // The root's parent is `null` in ESLint's tree, so the walk tests truthiness
    for (let parent = child.parent; parent; child = parent, parent = parent.parent) {
        if (FUNCTIONS.has(parent.type)) return undefined;
        if (isConditionalPart(parent, child)) return 'conditional';
        const statements = statementsOf(parent);
        if (statements === undefined) continue;
        for (let i = 0; i < statements.length && statements[i] !== child; i++) {
            if (containsReturn(statements[i], visitorKeys)) return 'afterReturn';
        }
    }
    return undefined;
}

/** Whether `child` runs only when a condition in `parent` allows it. */
function isConditionalPart(parent: AnyNode, child: AnyNode): boolean {
    switch (parent.type) {
        case 'IfStatement':
        case 'ConditionalExpression':
            return parent.test !== child;
        case 'LogicalExpression':
            return parent.right === child;
        case 'SwitchCase':
            return parent.test !== child;
        default:
            return false;
    }
}

/** The statements of a block, a program or a `case`, in order, or undefined for any other node. */
function statementsOf(node: AnyNode): readonly unknown[] | undefined {
    if (node.type === 'BlockStatement' || node.type === 'Program' || node.type === 'StaticBlock') {
        return node.body as readonly unknown[];
    }
    if (node.type === 'SwitchCase') return node.consequent as readonly unknown[];
    return undefined;
}

/** Whether a statement has a `return` of its own function in it, leaving nested functions out. */
function containsReturn(node: unknown, visitorKeys: SourceCode.VisitorKeys): boolean {
    if (typeof node !== 'object' || node === null) return false;
    const current = node as AnyNode;
    if (current.type === 'ReturnStatement') return true;
    if (FUNCTIONS.has(current.type)) return false;
    const keys = visitorKeys[current.type] ?? [];
    for (let i = 0; i < keys.length; i++) {
        const value = current[keys[i]];
        if (Array.isArray(value)) {
            for (let j = 0; j < value.length; j++) {
                if (containsReturn(value[j], visitorKeys)) return true;
            }
        }
        else if (containsReturn(value, visitorKeys)) {
            return true;
        }
    }
    return false;
}
