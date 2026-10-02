/**
 * `<List>` for three.js: the base's index-addressed list (`list.ts` in `@mvtjs/utils/jsx`,
 * where its behaviour is documented) over `Object3D`s.
 */

import type { Object3D } from 'three';
import { createList, type ListBindings as BaseListBindings } from '@mvtjs/utils/jsx';
import { threeTarget } from './three-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type { ListSource } from '@mvtjs/utils/jsx';

/** The bindings of a three.js `<List>`. */
export type ListBindings<T> = BaseListBindings<T, Object3D>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const List = createList({ target: threeTarget });
