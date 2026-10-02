/**
 * The JSX runtime for Pixi.js: the renderer-agnostic base (`@mvtjs/utils/jsx`)
 * over Pixi's scene graph (`pixi-target.ts`) and Pixi's intrinsic elements
 * (`pixi-elements.ts`).
 *
 * How the runtime behaves (rendering once, inert construction, bindings
 * polled from each element's refresh method, `visible` first) is in the base's
 * `create-jsx.ts`; what each Pixi attribute does, and how often it is
 * written, is in the element table. Why there are no cleanup scopes or
 * context providers: the base's `design-notes.md`. Pixi facts the JSX target
 * relies on: this directory's `design-notes.md`.
 */

import type { Container } from 'pixi.js';
import { createJsx, type IntrinsicElementsOf } from '@mvtjs/utils/jsx';
import { pixiElements } from './pixi-elements';
import { pixiTarget } from './pixi-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
    type Element = Container;
    type IntrinsicElements = IntrinsicElementsOf<Container, typeof pixiElements>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const { jsx, Fragment } = createJsx({ target: pixiTarget, elements: pixiElements });

/** jsxs is called for elements with static (known at compile time) children arrays. Same logic. */
export const jsxs = jsx;

/** jsxDEV is used in development mode by esbuild's jsx-dev-runtime. Same logic. */
export const jsxDEV = jsx;
