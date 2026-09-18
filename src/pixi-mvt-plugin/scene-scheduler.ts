import type { Container } from 'pixi.js';
import { createIncrementalListStrategy } from './incremental-list-strategy';
import { installMvtContainerMixin } from './mvt-container-mixin';
import { createRebuildListStrategy } from './rebuild-list-strategy';
import type {
    ListStrategy,
    SceneGraphOwner,
    SceneScheduler,
    SceneSchedulerOptions,
    SceneSchedulerStats,
    SchedulerStrategyKind,
    SlotLists,
} from './mvt-types';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a scheduler that drives `onUpdate` and `onRefresh` across the subtree
 * rooted at `root`.
 *
 * `root` does not need to be an `Application` stage, or attached to anything,
 * or ever rendered. That is the whole point: a scene can be stepped in a test
 * or stepped to produce a thumbnail without a renderer in sight.
 */
export function createSceneScheduler(
    root: Container,
    options: SceneSchedulerOptions = {},
): SceneScheduler {
    installMvtContainerMixin();

    const strategyKind: SchedulerStrategyKind = options.strategy ?? 'incremental';
    const maxDrainRounds = options.maxDrainRounds ?? DEFAULT_MAX_DRAIN_ROUNDS;

    const lists: SlotLists = {
        updateSlots: [],
        refreshSlots: [],
        updateTombstones: 0,
        refreshTombstones: 0,
    };

    // Containers attached while a pass is running. They are deliberately not
    // reached by the pass itself (it iterates a snapshot), and are run by the
    // drain that follows it.
    const pendingUpdate: Container[] = [];
    const pendingRefresh: Container[] = [];
    const drainBuffer: Container[] = [];

    const owner: SceneGraphOwner = { attachSubtree, detachSubtree, hookChanged };
    const strategy: ListStrategy = strategyKind === 'incremental'
        ? createIncrementalListStrategy(lists)
        : createRebuildListStrategy(lists, root);

    let passActive = false;
    let destroyed = false;
    let updateCalls = 0;
    let refreshCalls = 0;
    let drainRounds = 0;

    const stats: SceneSchedulerStats = {
        strategy: strategyKind,
        get updateCalls(): number {
            return updateCalls;
        },
        get refreshCalls(): number {
            return refreshCalls;
        },
        get updateSlotCount(): number {
            return lists.updateSlots.length;
        },
        get refreshSlotCount(): number {
            return lists.refreshSlots.length;
        },
        get rebuilds(): number {
            return strategy.rebuilds;
        },
        get compactions(): number {
            return strategy.compactions;
        },
        get drainRounds(): number {
            return drainRounds;
        },
    };

    attachSubtree(root);

    return { update, refresh, destroy, stats };

    // ---- Passes -----------------------------------------------------------

    function update(deltaMs: number): void {
        if (destroyed) return;
        strategy.sync();
        updateCalls = 0;
        pendingUpdate.length = 0;
        passActive = true;
        const slots = lists.updateSlots;
        // Snapshot the length: anything appended by a hook belongs to the
        // drain below, not to this loop.
        const end = slots.length;
        for (let i = 0; i < end; i++) {
            const node = slots[i];
            if (node === undefined) continue;
            // Covers both a tombstoned slot the strategy has not compacted and
            // a container detached earlier in this very pass.
            if (node._mvtOwner !== owner) continue;
            const hook = node.onUpdate;
            if (hook === undefined) continue;
            hook(deltaMs);
            updateCalls++;
        }
        drain(pendingUpdate, deltaMs, true);
        passActive = false;
    }

    function refresh(): void {
        if (destroyed) return;
        strategy.sync();
        refreshCalls = 0;
        pendingRefresh.length = 0;
        passActive = true;
        const slots = lists.refreshSlots;
        const end = slots.length;
        for (let i = 0; i < end; i++) {
            const node = slots[i];
            if (node === undefined) continue;
            if (node._mvtOwner !== owner) continue;
            const hook = node.onRefresh;
            if (hook === undefined) continue;
            hook();
            refreshCalls++;
        }
        drain(pendingRefresh, 0, false);
        passActive = false;
    }

    /**
     * Runs hooks on containers attached during the pass, repeatedly, so that a
     * view which builds its children in `onRefresh` sees them refreshed on the
     * same tick instead of showing one frame of constructor state.
     *
     * Ancestors-before-descendants still holds: a drained container was
     * attached under something the pass already visited, and within a round the
     * containers arrive in preorder.
     */
    function drain(pending: Container[], deltaMs: number, isUpdate: boolean): void {
        let rounds = 0;
        while (pending.length > 0) {
            if (rounds >= maxDrainRounds) {
                warnDrainCapReached(maxDrainRounds, isUpdate);
                pending.length = 0;
                break;
            }
            drainBuffer.length = 0;
            for (let i = 0; i < pending.length; i++) {
                drainBuffer.push(pending[i]);
            }
            pending.length = 0;
            for (let i = 0; i < drainBuffer.length; i++) {
                const node = drainBuffer[i];
                if (node._mvtOwner !== owner) continue;
                if (isUpdate) {
                    const hook = node.onUpdate;
                    if (hook === undefined) continue;
                    hook(deltaMs);
                    updateCalls++;
                }
                else {
                    const hook = node.onRefresh;
                    if (hook === undefined) continue;
                    hook();
                    refreshCalls++;
                }
            }
            rounds++;
            drainRounds++;
        }
    }

    // ---- Scene graph observation ------------------------------------------

    function attachSubtree(node: Container): void {
        node._mvtOwner = owner;
        const updateHook = node.onUpdate;
        const refreshHook = node.onRefresh;
        const hasUpdate = updateHook !== undefined;
        const hasRefresh = refreshHook !== undefined;
        if (hasUpdate || hasRefresh) {
            strategy.added(node);
            if (passActive) {
                if (hasUpdate) pendingUpdate.push(node);
                if (hasRefresh) pendingRefresh.push(node);
            }
        }
        const children = node.children;
        for (let i = 0; i < children.length; i++) {
            attachSubtree(children[i]);
        }
    }

    function detachSubtree(node: Container): void {
        if (node._mvtOwner !== owner) return;
        node._mvtOwner = undefined;
        strategy.removed(node);
        const children = node.children;
        for (let i = 0; i < children.length; i++) {
            detachSubtree(children[i]);
        }
    }

    /**
     * A hook was assigned or cleared on an attached container.
     *
     * Re-seating the whole subtree rather than appending the one container is
     * what closes the ordering hole that `onRender` has: appending an ancestor
     * whose descendants are already listed would place it after them.
     */
    function hookChanged(node: Container): void {
        if (node._mvtOwner !== owner) return;
        detachSubtree(node);
        attachSubtree(node);
    }

    // ---- Lifecycle ---------------------------------------------------------

    function destroy(): void {
        if (destroyed) return;
        destroyed = true;
        detachSubtree(root);
        lists.updateSlots.length = 0;
        lists.refreshSlots.length = 0;
        lists.updateTombstones = 0;
        lists.refreshTombstones = 0;
        pendingUpdate.length = 0;
        pendingRefresh.length = 0;
        drainBuffer.length = 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_MAX_DRAIN_ROUNDS = 4;

function warnDrainCapReached(cap: number, isUpdate: boolean): void {
    if (!import.meta.env.DEV) return;
    const pass = isUpdate ? 'onUpdate' : 'onRefresh';
    console.warn(
        `[mvt] ${pass} kept attaching containers after ${cap} drain rounds. `
        + 'A hook is most likely adding children unconditionally every tick.',
    );
}
