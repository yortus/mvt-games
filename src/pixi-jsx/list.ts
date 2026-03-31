/**
 * Generic `<List>` function component for typed dynamic lists.
 *
 * Unlike the `<list>` intrinsic, TypeScript infers the item type `T` from the
 * `of` getter and flows it into the `to` callback - no manual annotation
 * needed.
 *
 * ```tsx
 * <List of={getStars} to={(star) => <sprite texture={starTex} x={() => star.x} />} />
 * ```
 */

import { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ListProps<T> {
    of: () => readonly T[];
    to: (item: T, index: number) => Container;
    /** Optional version getter. When provided, zip-compare is skipped unless the version changes. */
    version?: () => unknown;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Sentinel guaranteeing the first reconcile always runs. */
const VERSION_UNSET: unique symbol = Symbol('VERSION_UNSET');

export function List<T>(props: ListProps<T>): Container {
    const container = new Container();

    // Snapshot of item references from the previous reconcile.
    const prev: unknown[] = [];

    let prevVersion: unknown = VERSION_UNSET;

    reconcile();
    container.onRender = reconcile;

    return container;

    /** Wrap a view result in a slot so replacements are grandchild swaps. */
    function createSlot(item: T, index: number): Container {
        const slot = new Container();
        slot.addChild(props.to(item, index));
        return slot;
    }

    function reconcile(): void {
        if (props.version !== undefined) {
            const v = props.version();
            if (v === prevVersion) return;
            prevVersion = v;
        }

        const items = props.of();
        const newLen = items.length;
        const oldLen = prev.length;

        // Single-pass zip-compare with two advancing indices.
        // ni = position in new items (also the write position in container)
        // oi = position in old prev
        let ni = 0;
        let oi = 0;

        while (ni < newLen && oi < oldLen) {
            if (items[ni] === prev[oi]) {
                prev[ni] = items[ni];
                ni++;
                oi++;
                continue;
            }

            // Single insertion: next new item matches current old
            if (ni + 1 < newLen && items[ni + 1] === prev[oi]) {
                container.addChildAt(createSlot(items[ni] as T, ni), ni);
                prev[ni] = items[ni];
                ni++;
                continue;
            }

            // Single deletion: current new matches next old
            if (oi + 1 < oldLen && items[ni] === prev[oi + 1]) {
                const slot = container.children[ni];
                container.removeChild(slot);
                slot.destroy({ children: true });
                oi++;
                continue;
            }

            // Replace: swap grandchild inside existing slot (no parent splice)
            const slot = container.children[ni];
            slot.children[0].destroy({ children: true });
            slot.addChild(props.to(items[ni] as T, ni));
            prev[ni] = items[ni];
            ni++;
            oi++;
        }

        // Remaining new items: appends
        while (ni < newLen) {
            container.addChild(createSlot(items[ni] as T, ni));
            prev[ni] = items[ni];
            ni++;
        }

        // Remaining old items: tail removals
        while (oi < oldLen) {
            const slot = container.children[container.children.length - 1];
            container.removeChild(slot);
            slot.destroy({ children: true });
            oi++;
        }

        prev.length = newLen;
    }
}
