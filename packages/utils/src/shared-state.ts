import { version } from '../package.json';
import { registerCopy, shareAcrossCopies } from './copies';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What every copy of @mvtjs/utils with the same protocol shares in a program:
 * its module-level state, kept in one object so that two copies agree. See
 * `shareAcrossCopies`.
 */
export interface UtilsState {
    /**
     * How many times any node's update or refresh method has been set, by any
     * tree. A scene pass records it on entry and, if it has changed, reads
     * methods live for the rest of that scene pass. Shared by every tree, and
     * every copy, so a method that assigns a method on another kind of node,
     * or through another copy, is safe too.
     */
    methodAssignments: number;
    /** The object `sceneCounter` exports. */
    readonly sceneCounter: { isCounting: boolean; methodCalls: number; walkRebuilds: number; rebuildVisits: number };
    /** The object `readCounter` exports. */
    readonly readCounter: { isCounting: boolean; count: number };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const utilsState: UtilsState = shareAcrossCopies(globalThis, '@mvtjs/utils', () => ({
    methodAssignments: 0,
    sceneCounter: { isCounting: false, methodCalls: 0, walkRebuilds: 0, rebuildVisits: 0 },
    readCounter: { isCounting: false, count: 0 },
}));

registerCopy('@mvtjs/utils', version);
