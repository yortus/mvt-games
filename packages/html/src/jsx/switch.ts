/**
 * `<Switch>` and `<Match>` for the DOM: the base's components
 * (`switch.ts` in `@mvtjs/utils/jsx`, where their behaviour is documented) over
 * elements.
 */

import { createSwitch } from '@mvtjs/utils/jsx';
import type { MatchBindings as BaseMatchBindings, SwitchBindings as BaseSwitchBindings } from '@mvtjs/utils/jsx';
import { htmlTarget } from './html-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The bindings of an HTML `<Switch>`. */
export type SwitchBindings = BaseSwitchBindings<Element>;

/** The bindings of an HTML `<Match>`: a `when` or an `else`, never both. */
export type MatchBindings = BaseMatchBindings<Element>;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export const { Switch, Match } = createSwitch({ target: htmlTarget });
