/**
 * `<List>` for PixiJS 3D: the base's index-addressed list (`list.ts` in `@mvtjs/utils/jsx`,
 * where its behaviour is documented) over `Container3D`s.
 */

import type { Container3D } from '@pixi/3d';
import { createList, type ListBindings as BaseListBindings } from '@mvtjs/utils/jsx';
import { pixi3dTarget } from './pixi3d-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type { ListSource } from '@mvtjs/utils/jsx';

/** The bindings of a PixiJS 3D `<List>`. */
export type ListBindings<T> = BaseListBindings<T, Container3D>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const List = createList({ target: pixi3dTarget });
