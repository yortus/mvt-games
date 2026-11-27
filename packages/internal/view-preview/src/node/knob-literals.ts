import ts from 'typescript';
import type { KnobKind, KnobValue } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A literal in a pose, which the preview turns into a knob. */
export interface KnobLiteral {
    /** The literal itself. A negative number is the minus sign and the number. */
    readonly node: ts.Node;
    readonly kind: KnobKind;
    readonly value: KnobValue;
    /** What it sets, such as `score` for `score: () => 1230`, or `pose arg 3`. */
    readonly label: string;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns the literals in a pose, in the order they're written, each of which
 * becomes a knob. A literal is a number, a boolean or a string, anywhere in
 * the pose but in a type or as a property's name. The knobs' indexes are
 * their places in this list, so the preview and a snapshot of it find the
 * same literal by the same index.
 */
export function listKnobLiterals(options: { readonly pose: ts.ArrowFunction | ts.FunctionExpression; readonly source: ts.SourceFile }): readonly KnobLiteral[] {
    const { pose, source } = options;
    const literals: KnobLiteral[] = [];
    const visit = (node: ts.Node): void => {
        // A literal in a type, such as `'easy'` in `Promise<'easy'>`, isn't a value
        if (ts.isTypeNode(node)) return;
        const literal = readLiteral(node, source);
        if (literal !== undefined && canBeKnob(node)) {
            literals.push({ node, ...literal, label: findLabel({ node, pose, source }) });
            return;
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(pose, visit);
    return literals;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns the literal a node is, or `undefined` if it isn't one. A negative number is a minus sign before a number. */
export function readLiteral(node: ts.Node, source: ts.SourceFile): { readonly kind: KnobKind; readonly value: KnobValue } | undefined {
    if (ts.isNumericLiteral(node)) {
        const text = node.getText(source).replaceAll('_', '');
        return { kind: /^0x[0-9a-f]{6}$/i.test(text) ? 'color' : 'number', value: Number(text) };
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
        return { kind: 'number', value: -Number(node.operand.getText(source).replaceAll('_', '')) };
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'boolean', value: true };
    if (node.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'boolean', value: false };
    if (ts.isStringLiteral(node)) return { kind: 'string', value: node.text };
    return undefined;
}

/** Returns whether a literal holds a value, rather than naming a property or a module. */
function canBeKnob(node: ts.Node): boolean {
    const parent = node.parent;
    if ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyAccessExpression(parent)) && parent.name === node) return false;
    if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword) return false;
    return true;
}

/**
 * Returns what a literal sets, for its knob's label. That's the property,
 * attribute, variable or parameter whose value it is. Or it's the call that
 * it's an argument of, such as `pose arg 3`. The search looks out from the
 * literal as far as the pose.
 */
function findLabel(options: { readonly node: ts.Node; readonly pose: ts.Node; readonly source: ts.SourceFile }): string {
    const { pose, source } = options;
    let child = options.node;
    while (child !== pose) {
        const current = child.parent;
        if (ts.isPropertyAssignment(current) && current.initializer === child) return current.name.getText(source);
        if (ts.isJsxAttribute(current)) return current.name.getText(source);
        if ((ts.isVariableDeclaration(current) || ts.isParameter(current)) && current.initializer === child) return current.name.getText(source);
        if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.EqualsToken && current.right === child) return current.left.getText(source);
        if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
            const index = current.arguments?.indexOf(child as ts.Expression) ?? -1;
            if (index >= 0) return `${findCalleeName(current.expression, source)} arg ${index + 1}`;
        }
        child = current;
    }
    return 'value';
}

/** Returns the name a call is made by: `openPuzzle` for `model.openPuzzle(...)`. */
function findCalleeName(callee: ts.Expression, source: ts.SourceFile): string {
    if (ts.isIdentifier(callee)) return callee.text;
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
    const text = callee.getText(source);
    return text.length > 24 ? `${text.slice(0, 24)}...` : text;
}
