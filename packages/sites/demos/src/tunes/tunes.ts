import { BREAKDOWN_BUILD } from './breakdown-build';
import { COPPER_SKY } from './copper-sky';
import { FUSE_BOX } from './fuse-box';
import { HAIRPIN_NIGHT } from './hairpin-night';
import { LANTERN } from './lantern';
import { LONG_EXPOSURE } from './long-exposure';
import { MEADOW_HOP } from './meadow-hop';
import { NIGHT_BUS } from './night-bus';
import { ROUND_ONE } from './round-one';
import { SCRAMBLE_WING } from './scramble-wing';
import { SETUP_COMPLETE } from './setup-complete';
import { SLOW_BURN } from './slow-burn';
import { SQUELCH } from './squelch';
import type { Tune } from './tune';
import { WAREHOUSE_KEYS } from './warehouse-keys';
import { WAYFARERS_ROAD } from './wayfarers-road';

export type { Tune } from './tune';
export {
    BREAKDOWN_BUILD, COPPER_SKY, FUSE_BOX, HAIRPIN_NIGHT, LANTERN, LONG_EXPOSURE, MEADOW_HOP, NIGHT_BUS, ROUND_ONE, SCRAMBLE_WING,
    SETUP_COMPLETE, SLOW_BURN, SQUELCH, WAREHOUSE_KEYS, WAYFARERS_ROAD,
};

/** Every tune, in the order the demos list them: the decade's pop first, then its games. */
export const TUNES: readonly Tune[] = [
    WAREHOUSE_KEYS,
    BREAKDOWN_BUILD,
    SQUELCH,
    NIGHT_BUS,
    SLOW_BURN,
    FUSE_BOX,
    LONG_EXPOSURE,
    LANTERN,
    SCRAMBLE_WING,
    WAYFARERS_ROAD,
    ROUND_ONE,
    SETUP_COMPLETE,
    COPPER_SKY,
    HAIRPIN_NIGHT,
    MEADOW_HOP,
];
