/**
 * `<List>` for Pixi: the base's index-addressed list (`../mvt-utils/jsx/list.ts`,
 * where its behaviour is documented) over Pixi containers.
 */

import type { Container } from 'pixi.js';
import { createList, type ListBindings as BaseListBindings } from '../../mvt-utils/jsx';
import { pixiTarget } from './pixi-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type { ListSource } from '../../mvt-utils/jsx';

/** The bindings of a Pixi `<List>`. */
export type ListBindings<T> = BaseListBindings<T, Container>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const List = createList({ target: pixiTarget });
