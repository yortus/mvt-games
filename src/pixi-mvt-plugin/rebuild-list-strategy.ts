import type { Container } from 'pixi.js';
import type { ListStrategy, SlotLists } from './mvt-types';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Maintains the call lists by discarding them and re-walking the whole tree
 * whenever anything changed since the last pass.
 *
 * This is the baseline. It is obviously correct, it is about thirty lines, and
 * its worst case (a scene that changes every tick) is the same full depth-first
 * walk that the incremental strategy avoids entirely. Keeping it around is what
 * makes the incremental strategy's advantage a measurement rather than a claim.
 */
export function createRebuildListStrategy(lists: SlotLists, root: Container): ListStrategy {
    let dirty = true;
    let rebuilds = 0;

    return {
        added,
        removed,
        sync,
        get rebuilds(): number {
            return rebuilds;
        },
        get compactions(): number {
            return 0;
        },
    };

    function added(_node: Container): void {
        dirty = true;
    }

    function removed(_node: Container): void {
        dirty = true;
    }

    function sync(): void {
        if (!dirty) return;
        dirty = false;
        lists.updateSlots.length = 0;
        lists.refreshSlots.length = 0;
        lists.updateTombstones = 0;
        lists.refreshTombstones = 0;
        collect(root);
        rebuilds++;
    }

    /** Preorder, so ancestors always land before their descendants. */
    function collect(node: Container): void {
        if (node.onUpdate !== undefined) lists.updateSlots.push(node);
        if (node.onRefresh !== undefined) lists.refreshSlots.push(node);
        const children = node.children;
        for (let i = 0; i < children.length; i++) {
            collect(children[i]);
        }
    }
}
