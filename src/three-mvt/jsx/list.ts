/**
 * `<List>` for three.js: the base's index-addressed list (`../mvt-utils/jsx/list.ts`,
 * where its behaviour is documented) over `Object3D`s.
 */

import type { Object3D } from 'three';
import { createList, type ListBindings as BaseListBindings } from '../../mvt-utils/jsx';
import { threeTarget } from './three-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type { ListSource } from '../../mvt-utils/jsx';

/** The bindings of a three.js `<List>`. */
export type ListBindings<T> = BaseListBindings<T, Object3D>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const List = createList({ target: threeTarget });
