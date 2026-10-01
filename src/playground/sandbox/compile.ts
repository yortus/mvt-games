// ---------------------------------------------------------------------------
// Sandbox compilation - turns the editors' TypeScript into runnable JavaScript
// ---------------------------------------------------------------------------
// Kept free of the DOM, so it can be tested outside the sandbox iframe.
// ---------------------------------------------------------------------------

import type { Container } from 'pixi.js';
import { type Options, transform } from 'sucrase';
import { Fragment, jsx, List, Match, Switch } from '#pixi-mvt/jsx';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Which editor the code came from. View code may use JSX; model code may not. */
export type CodeKind = 'model' | 'view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Transpile the code from one editor to JavaScript: TypeScript types are
 * stripped, and in view code, JSX becomes calls to `h` (see `jsxGlobals`).
 * Import statements are removed first, since the sandbox supplies everything
 * the code may use as globals. Throws on a syntax error.
 */
export function transpile(code: string, kind: CodeKind): string {
    const cleaned = code.replace(/^\s*import\s+.*?['"].*?['"];?\s*$/gm, '// [import stripped]');
    return transform(cleaned, kind === 'view' ? VIEW_OPTIONS : MODEL_OPTIONS).code;
}

/**
 * The globals that JSX in view code compiles to: `h` and `Fragment`, and the
 * JSX runtime's components.
 */
export const jsxGlobals: Readonly<Record<string, unknown>> = { h, Fragment, List, Switch, Match };

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Model code: TypeScript only. */
const MODEL_OPTIONS: Options = {
    transforms: ['typescript'],
    disableESTransforms: true,
};

/** View code: TypeScript and JSX. */
const VIEW_OPTIONS: Options = {
    transforms: ['typescript', 'jsx'],
    // Classic JSX calls a function by name. The automatic form would insert an
    // import, which the sandbox cannot resolve.
    jsxRuntime: 'classic',
    jsxPragma: 'h',
    jsxFragmentPragma: 'Fragment',
    production: true,
    disableESTransforms: true,
};

/**
 * Classic JSX's call, `h(type, attributes, ...children)`, adapted to the JSX
 * runtime's `jsx(type, attributes)`, which takes children in
 * `attributes.children`.
 */
function h(
    type: Parameters<typeof jsx>[0],
    attributes: Record<string, unknown> | null,
    ...children: unknown[]
): Container {
    const allAttributes = attributes ?? {};
    if (children.length === 1) allAttributes.children = children[0];
    else if (children.length > 1) allAttributes.children = children;
    return jsx(type, allAttributes);
}
