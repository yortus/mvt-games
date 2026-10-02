/**
 * `<List>` for the DOM: the base's index-addressed list (`list.ts` in `@mvtjs/utils/jsx`,
 * where its behaviour is documented) over elements.
 */

import { createList, type ListBindings as BaseListBindings } from '@mvtjs/utils/jsx';
import { htmlTarget } from './html-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export type { ListSource } from '@mvtjs/utils/jsx';

/** The bindings of an HTML `<List>`. */
export type ListBindings<T> = BaseListBindings<T, Element>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const List = createList({ target: htmlTarget });
