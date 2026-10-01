/**
 * `<List>` for the DOM: the base's index-addressed list (`../mvt-utils/jsx/list.ts`,
 * where its behaviour is documented) over elements.
 */

import { createList, type ListBindings as BaseListBindings } from '#mvt-utils/jsx';
import { htmlTarget } from './html-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type { ListSource } from '#mvt-utils/jsx';

/** The bindings of an HTML `<List>`. */
export type ListBindings<T> = BaseListBindings<T, Element>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const List = createList({ target: htmlTarget });
