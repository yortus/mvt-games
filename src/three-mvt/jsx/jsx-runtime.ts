/**
 * The JSX runtime for three.js: the renderer-agnostic base (`@mvtjs/utils/jsx`) over
 * three's scene graph (`three-target.ts`) and its intrinsic elements
 * (`three-elements.ts`).
 *
 * How the runtime behaves is in the base's `create-jsx.ts`; what each
 * attribute does, and how often it is written, is in the element table. The
 * elements' methods are called by three-mvt's scene passes (`tickScene`),
 * not from three's `onBeforeRender`, which skips objects out of view.
 */

import type { Object3D } from 'three';
import { createJsx, type IntrinsicElementsOf } from '@mvtjs/utils/jsx';
import { threeElements } from './three-elements';
import { threeTarget } from './three-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
    type Element = Object3D;
    type IntrinsicElements = IntrinsicElementsOf<Object3D, typeof threeElements>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const { jsx, Fragment } = createJsx({ target: threeTarget, elements: threeElements });

/** jsxs is called for elements with static (known at compile time) children arrays. Same logic. */
export const jsxs = jsx;

/** jsxDEV is used in development mode by esbuild's jsx-dev-runtime. Same logic. */
export const jsxDEV = jsx;
