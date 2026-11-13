import { ARCADE_CONTROL_KEYS } from './arcade-control-keys';
import type { ArcadeControl } from './arcade-controls';
import { describeKey } from './describe-key';

/**
 * Names an arcade control by its first key in the table, in words. A game
 * uses it in text it shows, such as "Press Enter to restart". The text then
 * follows the table, so it can't name a key that does nothing.
 */
export function describeControl(control: ArcadeControl): string {
    return describeKey(ARCADE_CONTROL_KEYS[control][0]);
}
