/**
 * `<Switch>` and `<Match>` for the DOM: the base's components
 * (`../mvt-utils/jsx/switch.ts`, where their behaviour is documented) over
 * elements.
 */

import { createSwitch } from '../../mvt-utils/jsx';
import type { MatchBindings as BaseMatchBindings, SwitchBindings as BaseSwitchBindings } from '../../mvt-utils/jsx';
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
