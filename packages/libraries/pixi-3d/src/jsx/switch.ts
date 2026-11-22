/**
 * `<Switch>` and `<Match>` for PixiJS 3D: the base's components
 * (`switch.ts` in `@mvtjs/utils/jsx`, where their behaviour is documented) over
 * `Container3D`s.
 */

import type { Container3D } from '@pixi/3d';
import { createSwitch } from '@mvtjs/utils/jsx';
import type { MatchBindings as BaseMatchBindings, SwitchBindings as BaseSwitchBindings } from '@mvtjs/utils/jsx';
import { pixi3dTarget } from './pixi3d-target';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The bindings of a PixiJS 3D `<Switch>`. */
export type SwitchBindings = BaseSwitchBindings<Container3D>;

/** The bindings of a PixiJS 3D `<Match>`: a `when` or an `else`, never both. */
export type MatchBindings = BaseMatchBindings<Container3D>;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export const { Switch, Match } = createSwitch({ target: pixi3dTarget });
