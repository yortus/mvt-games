/**
 * `<List>` for Pixi: the base's index-addressed list (`list.ts` in `@mvtjs/utils/jsx`,
 * where its behaviour is documented) over Pixi containers.
 */

import type { Container } from 'pixi.js';
import { createList, type ListBindings as BaseListBindings } from '@mvtjs/utils/jsx';
import { pixiTarget } from './pixi-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type { ListSource } from '@mvtjs/utils/jsx';

/** The bindings of a Pixi `<List>`. */
export type ListBindings<T> = BaseListBindings<T, Container>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const List = createList({ target: pixiTarget });
