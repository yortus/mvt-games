/**
 * `<Switch>` and `<Match>` for Pixi: the base's components
 * (`../mvt-utils/jsx/switch.ts`, where their behaviour is documented) over Pixi
 * containers.
 */

import type { Container } from 'pixi.js';
import {
    createSwitch, type MatchBindings as BaseMatchBindings, type SwitchBindings as BaseSwitchBindings,
} from '../../mvt-utils/jsx';
import { pixiTarget } from './pixi-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The bindings of a Pixi `<Switch>`. */
export type SwitchBindings = BaseSwitchBindings<Container>;

/** The bindings of a Pixi `<Match>`: a `when` or an `else`, never both. */
export type MatchBindings = BaseMatchBindings<Container>;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export const { Switch, Match } = createSwitch({ target: pixiTarget });
