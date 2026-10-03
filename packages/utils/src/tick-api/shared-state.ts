import { version } from '../../package.json';
import { registerCopy, shareAcrossCopies } from '../copies';
import type { TickCounter } from './tick-counter';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What every copy of @mvtjs/utils with the same protocol shares in a program:
 * its module-level state, kept in one object so that two copies agree. See
 * `shareAcrossCopies`. All of it is the tick API's, which is why it lives
 * here.
 */
export interface UtilsState {
    /**
     * How many times any node's update or refresh method has been set, by any
     * renderer. Invoking a method list records it on entry and, if it has
     * changed, reads methods live for the rest of that invocation. Shared by
     * every renderer, and every copy, so a method that assigns a method on
     * another kind of node, or through another copy, is safe too.
     */
    methodAssignments: number;
    /** The object `tickCounter` exports. */
    readonly tickCounter: TickCounter;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const utilsState: UtilsState = shareAcrossCopies(globalThis, '@mvtjs/utils', () => ({
    methodAssignments: 0,
    tickCounter: { isCounting: false, reads: 0, methodCalls: 0, methodListRebuilds: 0, rebuildNodeVisits: 0 },
}));

// Registered here because this is the module every program that uses the
// package loads, through the tick API, and the one `sideEffects` keeps.
registerCopy('@mvtjs/utils', version);
