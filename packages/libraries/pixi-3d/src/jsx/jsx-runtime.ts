/**
 * The JSX runtime for PixiJS 3D: the renderer-agnostic base (`@mvtjs/utils/jsx`)
 * over PixiJS 3D's scene graph (`pixi3d-target.ts`) and its intrinsic elements
 * (`pixi3d-elements.ts`).
 *
 * How the runtime behaves is in the base's `create-jsx.ts`. What each
 * attribute does, and how often it is written, is in the element table. A
 * 3D tree built here goes into a 2D Pixi tree through `Scene3DView`.
 */

import type { Container3D } from '@pixi/3d';
import { createJsx, type IntrinsicElementsOf } from '@mvtjs/utils/jsx';
// Registers PixiJS 3D's nodes, so `refreshView` walks what this runtime builds,
// and brings the `RendererViews` declaration with this entry point's types.
import '../container3d-mixin';
import { pixi3dElements } from './pixi3d-elements';
import { type OwnedResource, pixi3dTarget } from './pixi3d-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
    type Element = Container3D;
    type IntrinsicElements = IntrinsicElementsOf<Container3D, typeof pixi3dElements, OwnedResource>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const { jsx, Fragment } = createJsx({ target: pixi3dTarget, elements: pixi3dElements });

/** jsxs is called for elements with static (known at compile time) children arrays. Same logic. */
export const jsxs = jsx;

/** jsxDEV is used in development mode by esbuild's jsx-dev-runtime. Same logic. */
export const jsxDEV = jsx;
