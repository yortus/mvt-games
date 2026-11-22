import type { Rule } from 'eslint';

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

/**
 * Reports a geometry, material or texture made inside the attribute that
 * uses it, as in `<mesh geometry={new CubeGeometry()} />`. A resource made
 * there isn't stored in a variable, so your view can't list it in an `owns`
 * attribute, and it's never freed. Each time the view is made and destroyed,
 * another copy stays in GPU memory. Make it in a variable beside the JSX
 * instead, and list it in `owns` on the element that uses it, or on an
 * ancestor of that element in the same view.
 *
 * The rule allows a `new` passed straight to a function, as in
 * `kit.own(new PlaneGeometry())`, since the function receives it and may
 * free it later.
 */
export const noUnownedResource: Rule.RuleModule = {
    meta: {
        type: 'problem',
        docs: { description: 'Disallow making a geometry, material or texture inside a JSX attribute, where `owns` can\'t list it' },
        schema: [],
        messages: {
            unowned: 'This `new {{name}}(...)` is made inside the `{{attribute}}` attribute, so your view can\'t list it '
                + 'in `owns`, and it\'s never freed. Make it in a variable beside the JSX, and list it in `owns` on the '
                + 'element that uses it, or on an ancestor of that element.',
        },
    },
    create(context) {
        return {
            JSXAttribute: (node: JsxAttribute) => {
                const attribute = node.name.type === 'JSXIdentifier' ? node.name.name : undefined;
                if (attribute === undefined || !RESOURCE_ATTRIBUTES.has(attribute)) return;
                if (node.value?.type !== 'JSXExpressionContainer' || node.value.expression === undefined) return;
                const made = findNewExpression(node.value.expression);
                if (made === undefined) return;
                context.report({ node: made, messageId: 'unowned', data: { name: describeCallee(made), attribute } });
            },
        };
    },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A JSX attribute, with only the fields that the rule reads. ESLint's own types don't include JSX nodes. */
interface JsxAttribute {
    readonly name: { readonly type: string; readonly name?: string };
    readonly value?: { readonly type: string; readonly expression?: object };
}

/** ESTree's node types, as ESLint's visitors receive them. */
type NewExpression = Parameters<NonNullable<Rule.RuleListener['NewExpression']>>[0];

/** The attributes whose value is a resource that a view must free. */
const RESOURCE_ATTRIBUTES: ReadonlySet<string> = new Set(['geometry', 'material', 'texture']);

/** Finds the first `new` in an expression, searching depth first from the outside in, and skipping any passed to a function. */
function findNewExpression(node: object): NewExpression | undefined {
    const type = (node as { type?: unknown }).type;
    if (type === 'NewExpression') return node as NewExpression;
    for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        // A function receives its arguments, and may free them itself
        if (type === 'CallExpression' && key === 'arguments') continue;
        const value = (node as Record<string, unknown>)[key];
        const children = Array.isArray(value) ? value : [value];
        for (const child of children) {
            if (!isNode(child)) continue;
            const found = findNewExpression(child);
            if (found !== undefined) return found;
        }
    }
    return undefined;
}

function isNode(value: unknown): value is { readonly type: string } {
    return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

function describeCallee(node: NewExpression): string {
    const callee = node.callee;
    if (callee.type === 'Identifier') return callee.name;
    if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') return callee.property.name;
    return '...';
}
