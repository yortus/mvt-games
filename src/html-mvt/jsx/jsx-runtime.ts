/**
 * The JSX runtime for the DOM: the renderer-agnostic base (`@mvtjs/utils/jsx`) over
 * the DOM's element tree (`html-target.ts`) and its intrinsic elements
 * (`html-elements.ts`).
 *
 * How the runtime behaves is in the base's `create-jsx.ts`; what each
 * attribute does, and how often it is written, is in the element table. The
 * elements' methods are called by html-mvt's scene passes (`tickScene`).
 *
 * Not a framework for web pages: an HTML view here is built once and follows
 * its model through bindings, like any other MVT view. There is no text
 * content in JSX (`<p>score</p>`); text goes in the `text` attribute.
 */

import { createJsx, type IntrinsicElementsOf } from '@mvtjs/utils/jsx';
import { htmlElements } from './html-elements';
import { htmlTarget } from './html-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// The DOM's `Element`, named outside the namespace, where `Element` means the
// type being declared.
type DomElement = Element;

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
    /**
     * Any element, so SVG elements can be children one day. Components and
     * `<List>` return one.
     */
    type Element = DomElement;
    type IntrinsicElements = IntrinsicElementsOf<DomElement, typeof htmlElements>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const { jsx, Fragment } = createJsx({ target: htmlTarget, elements: htmlElements });

/** jsxs is called for elements with static (known at compile time) children arrays. Same logic. */
export const jsxs = jsx;

/** jsxDEV is used in development mode by esbuild's jsx-dev-runtime. Same logic. */
export const jsxDEV = jsx;
