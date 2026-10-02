/**
 * `<Switch>` and `<Match>` for three.js: the base's components
 * (`switch.ts` in `@mvtjs/utils/jsx`, where their behaviour is documented) over
 * `Object3D`s.
 */

import type { Object3D } from 'three';
import { createSwitch } from '@mvtjs/utils/jsx';
import type { MatchBindings as BaseMatchBindings, SwitchBindings as BaseSwitchBindings } from '@mvtjs/utils/jsx';
import { threeTarget } from './three-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The bindings of a three.js `<Switch>`. */
export type SwitchBindings = BaseSwitchBindings<Object3D>;

/** The bindings of a three.js `<Match>`: a `when` or an `else`, never both. */
export type MatchBindings = BaseMatchBindings<Object3D>;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export const { Switch, Match } = createSwitch({ target: threeTarget });
