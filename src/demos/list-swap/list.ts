/**
 * Proposed `<List>`: index-addressed, identity-blind, no reconciliation.
 *
 * The list knows only how many items it holds. Slots are built once per index
 * and never rebuilt. Surplus slots are detached rather than destroyed, which
 * takes them out of the refresh pass - so a parked slot costs nothing per
 * frame, and its index-bound getters never run with an out-of-range index.
 *
 * A local copy of an earlier design: the proposal's version hides surplus
 * slots with `SKIP_DESCENDANTS` instead of detaching them. See section 4.4 of
 * `proposals/004-list-proposal.md`.
 */

import { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ListProps {
    /** How many items the list currently holds. */
    length: () => number;
    /** Builds the slot for `index`. Called once per index, ever. */
    children: (index: number) => Container;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function List(props: ListProps): Container {
    const container = new Container();

    // High-water-mark pool. `slots[i]` is built on first need and retained for
    // the lifetime of the list, attached or not.
    const slots: Container[] = [];

    resize();

    // The refresh pass visits this container before its slots, so a slot
    // detached here is skipped this frame and never reads past the end of the
    // list. The pass also runs before rendering, so structural changes land in
    // the same frame.
    container.onRefresh = resize;

    return container;

    function resize(): void {
        const length = props.length();
        const children = container.children;
        if (length === children.length) return;

        // Growth and shrink both happen at the tail only, so child order stays
        // identical to slot order without any sorting or splicing.
        while (children.length < length) {
            const index = children.length;
            let slot = slots[index];
            if (slot === undefined) {
                slot = props.children(index);
                slots[index] = slot;
            }
            container.addChild(slot);
        }
        while (children.length > length) {
            container.removeChild(children[children.length - 1]);
        }
    }
}
