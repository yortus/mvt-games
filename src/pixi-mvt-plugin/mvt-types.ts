import type { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Advances a view's cosmetic presentation state. Always fires, every tick. */
export type UpdateHook = (deltaMs: number) => void;

/** Syncs a view's presentation output from model state. Must be idempotent. */
export type RefreshHook = () => void;

// ---------------------------------------------------------------------------
// Scene graph observation
// ---------------------------------------------------------------------------

/**
 * The scheduler side of the container mixin. Containers carry a reference to
 * the owner of the tree they belong to, so structural mutations can be routed
 * to exactly one scheduler without searching.
 */
export interface SceneGraphOwner {
    /** A subtree joined the managed tree. `node` is the subtree root. */
    attachSubtree(node: Container): void;
    /** A subtree left the managed tree. `node` is the subtree root. */
    detachSubtree(node: Container): void;
    /** A container's `onUpdate` / `onRefresh` assignment changed. */
    hookChanged(node: Container): void;
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/**
 * Which call-list maintenance strategy a scheduler uses. Both satisfy the same
 * observable contract; they exist side by side so the cost of each can be
 * measured rather than assumed.
 *
 * - `rebuild` - a full depth-first walk of the tree whenever anything changed
 *   since the last pass. Simple, and the baseline to beat.
 * - `incremental` - appends attached subtrees to the tail of the list and
 *   tombstones detached ones, compacting when tombstones get dense. Never
 *   walks the whole tree after construction.
 */
export type SchedulerStrategyKind = 'rebuild' | 'incremental';

export interface SceneSchedulerOptions {
    /** Defaults to `'incremental'`. */
    strategy?: SchedulerStrategyKind;
    /**
     * How many times a pass will re-run newly attached hooks before giving up.
     * Guards against a refresh that spawns children forever. Defaults to 4.
     */
    maxDrainRounds?: number;
}

/** Diagnostics. Read by the demo and the benchmark, not by game code. */
export interface SceneSchedulerStats {
    readonly strategy: SchedulerStrategyKind;
    /** Hook invocations in the most recent pass of each kind. */
    readonly updateCalls: number;
    readonly refreshCalls: number;
    /** Containers currently in each call list, tombstones included. */
    readonly updateSlotCount: number;
    readonly refreshSlotCount: number;
    /** Cumulative full-tree walks (`rebuild` strategy only). */
    readonly rebuilds: number;
    /** Cumulative list compactions (`incremental` strategy only). */
    readonly compactions: number;
    /** Cumulative drain rounds triggered by hooks attaching new containers. */
    readonly drainRounds: number;
}

/**
 * Drives `onUpdate` and `onRefresh` across a scene graph.
 *
 * Both passes visit containers in an order where every container is called
 * before any of its descendants. Sibling order is deliberately unspecified:
 * a view that depends on a sibling's presentation output is reading state that
 * should have come from the model.
 *
 * Nothing here touches a ticker. The caller decides when passes run, which is
 * what makes a scene testable without an Application or a renderer.
 */
export interface SceneScheduler {
    /** Runs `onUpdate(deltaMs)` over the tree. */
    update(deltaMs: number): void;
    /** Runs `onRefresh()` over the tree. */
    refresh(): void;
    /** Releases the tree. Safe to call twice. */
    destroy(): void;
    readonly stats: SceneSchedulerStats;
}

// ---------------------------------------------------------------------------
// List strategy (internal)
// ---------------------------------------------------------------------------

/** The call lists, owned by the scheduler and maintained by a strategy. */
export interface SlotLists {
    updateSlots: (Container | undefined)[];
    refreshSlots: (Container | undefined)[];
    updateTombstones: number;
    refreshTombstones: number;
}

/**
 * List maintenance, factored out so the two approaches can be swapped behind
 * an identical scheduler. The scheduler handles tree walking, ownership
 * stamping, pass iteration and draining; a strategy only decides how the
 * slot lists absorb a change.
 */
export interface ListStrategy {
    /** A hook-bearing container joined the tree. Called in preorder. */
    added(node: Container): void;
    /** A hook-bearing container left the tree. */
    removed(node: Container): void;
    /** Bring the lists up to date. Called at the start of every pass. */
    sync(): void;
    readonly rebuilds: number;
    readonly compactions: number;
}
