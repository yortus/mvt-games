/**
 * `<Switch>` and `<Match>` for three.js: the base's components
 * (`../mvt-utils/jsx/switch.ts`, where their behaviour is documented) over
 * `Object3D`s.
 */

import type { Object3D } from 'three';
import {
    createSwitch, type MatchBindings as BaseMatchBindings, type SwitchBindings as BaseSwitchBindings,
} from '../../mvt-utils/jsx';
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
