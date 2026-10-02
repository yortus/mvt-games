/**
 * `<Switch>` and `<Match>` for Pixi: the base's components
 * (`switch.ts` in `@mvtjs/utils/jsx`, where their behaviour is documented) over Pixi
 * containers.
 */

import type { Container } from 'pixi.js';
import { createSwitch } from '@mvtjs/utils/jsx';
import type { MatchBindings as BaseMatchBindings, SwitchBindings as BaseSwitchBindings } from '@mvtjs/utils/jsx';
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
