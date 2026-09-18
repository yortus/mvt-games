import type { Container } from 'pixi.js';
import type { ListStrategy, SlotLists } from './mvt-types';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Maintains the call lists incrementally, never walking the whole tree after
 * construction.
 *
 * This is only sound because sibling order carries no guarantee. The invariant
 * is that every container appears before its descendants, and appending an
 * attached subtree to the tail preserves it: each node's ancestors are either
 * inside the appended block (earlier, because the block is in preorder) or were
 * already in the list before the block started. Detaching tombstones the
 * subtree's slots and leaves the rest of the list untouched.
 *
 * Cost is therefore proportional to the size of the change, not the size of
 * the scene. Tombstones are compacted away once they reach half the list, which
 * amortises to constant work per removal.
 */
export function createIncrementalListStrategy(lists: SlotLists): ListStrategy {
    let compactions = 0;

    return {
        added,
        removed,
        sync,
        get rebuilds(): number {
            return 0;
        },
        get compactions(): number {
            return compactions;
        },
    };

    function added(node: Container): void {
        if (node.onUpdate !== undefined && node._mvtUpdateSlot < 0) {
            node._mvtUpdateSlot = lists.updateSlots.length;
            lists.updateSlots.push(node);
        }
        if (node.onRefresh !== undefined && node._mvtRefreshSlot < 0) {
            node._mvtRefreshSlot = lists.refreshSlots.length;
            lists.refreshSlots.push(node);
        }
    }

    function removed(node: Container): void {
        const updateSlot = node._mvtUpdateSlot;
        if (updateSlot >= 0) {
            lists.updateSlots[updateSlot] = undefined;
            lists.updateTombstones++;
            node._mvtUpdateSlot = -1;
        }
        const refreshSlot = node._mvtRefreshSlot;
        if (refreshSlot >= 0) {
            lists.refreshSlots[refreshSlot] = undefined;
            lists.refreshTombstones++;
            node._mvtRefreshSlot = -1;
        }
    }

    // Only ever called between passes, so it is safe to shift indices here.
    function sync(): void {
        if (lists.updateTombstones * 2 > lists.updateSlots.length) {
            compact(lists.updateSlots, setUpdateSlot);
            lists.updateTombstones = 0;
            compactions++;
        }
        if (lists.refreshTombstones * 2 > lists.refreshSlots.length) {
            compact(lists.refreshSlots, setRefreshSlot);
            lists.refreshTombstones = 0;
            compactions++;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type SlotWriter = (node: Container, slot: number) => void;

function setUpdateSlot(node: Container, slot: number): void {
    node._mvtUpdateSlot = slot;
}

function setRefreshSlot(node: Container, slot: number): void {
    node._mvtRefreshSlot = slot;
}

/** Squeezes out tombstones in place, preserving relative order. */
function compact(slots: (Container | undefined)[], writeSlot: SlotWriter): void {
    let write = 0;
    for (let read = 0; read < slots.length; read++) {
        const node = slots[read];
        if (node === undefined) continue;
        slots[write] = node;
        writeSlot(node, write);
        write++;
    }
    slots.length = write;
}
