import type { Watchable } from './watched';

/** A condition for a reaction's `when`: the value went up. */
export const increased = <T extends number | bigint>(current: T, previous: T): boolean => current > previous;

/** A condition for a reaction's `when`: the value went down. */
export const decreased = <T extends number | bigint>(current: T, previous: T): boolean => current < previous;

/** Returns a condition for a reaction's `when`: the value changed from `value`. */
export function changedFrom<T extends Watchable>(value: NoInfer<T>): (current: T, previous: T) => boolean {
    return (_current, previous) => previous === value;
}
