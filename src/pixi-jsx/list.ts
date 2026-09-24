/**
 * Index-addressed `<List>` function component.
 *
 * The list reads a source shaped like a read-only array - a `length` and an
 * `at(i)` - which arrays already are. It never compares items, never diffs and
 * never reconciles: slot `i` renders whatever is at index `i` right now,
 * re-read every frame, so a reorder does no structural work at all.
 *
 * ```tsx
 * <List items={bullets.slots}>
 *     {(slot) => <sprite texture={bulletTexture} x={() => slot().value.x} />}
 * </List>
 * ```
 *
 * An item view must not capture item data at construction time: slot `i` will
 * later hold a different item. Everything item-dependent must be a getter,
 * which is why `children` receives an accessor rather than a value.
 *
 * See `proposals/004-list-proposal.md` for the design.
 */

import { Container } from 'pixi.js';
import { refreshScene, SKIP_DESCENDANTS } from '../pixi-mvt';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a `<List>` projects: `length` slots, where `at(i)` is the item at `i`,
 * or `undefined` for an empty slot. Arrays satisfy it as they are, and so do
 * `SlotList.slots` and `OrderedSlotList.slots`/`.ordered`. Anything else is a
 * two-member object literal:
 *
 * ```tsx
 * <List items={{ length: () => model.enemyCount, at: (i) => model.getEnemy(i) }}>
 *
 * // Addressed by index alone: `at` returns the index, so every slot is present
 * <List items={{ length: () => model.lives, at: (i) => i }}>
 * ```
 *
 * `at` is deliberately required. Every function has a numeric `length` (its
 * arity), so with `at` optional, any function would type-check as a source:
 * `items={() => model.count}` would compile and silently render nothing.
 */
export interface ListSource<T> {
    /**
     * How many slots. A number is read as it is; a function is called once per
     * frame, following the runtime's rule that a function is live. Either way
     * the list reads it once per frame and shares it with every slot.
     */
    readonly length: number | (() => number);
    at(index: number): T | undefined;
}

export interface ListProps<T> {
    /**
     * The items to project, as a source or a getter returning one.
     *
     * - **A source** (`items={model.tiles}`) is a fixed reference whose
     *   contents are read every frame. Right for a collection the model
     *   mutates in place, which is how models in this repo own collections.
     * - **A getter** (`items={getStars}`) re-reads the reference every frame
     *   too. Needed when the model replaces its collection rather than
     *   mutating it. It should return a stored collection, not build a new
     *   one, since it runs every frame.
     *
     * Read once per frame, then `at(i)` once per slot. The result is cached for
     * that slot's bindings, so an item view costs one lookup however many
     * bindings it has.
     */
    items: ListSource<T> | (() => ListSource<T>);
    /**
     * Builds the view for `index`. Called at most once per index, ever, on the
     * first frame `length` covers it, occupied or not.
     *
     * Call the accessor only inside bindings and refresh hooks, never while
     * building: the slot may be empty when it is built. Bindings are safe,
     * because they first run on the slot's first refresh, and an empty slot
     * skips its whole subtree.
     */
    children: (item: () => T, index: number) => Container;
    /** Handle on the list's own container, e.g. to set `sortableChildren`. */
    ref?: (el: Container) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function List<T>(props: ListProps<T>): Container {
    const container = new Container();
    const items = props.items;

    // High-water-mark pool. Slot `i` is child `i`, built when `length` first
    // covers it and never removed, detached or destroyed; an empty slot hides
    // and skips its subtree instead (section 4.4 of the proposal).
    const slots: Container[] = [];

    // Resolved once per slot per frame, read by that slot's bindings.
    const resolved: (T | undefined)[] = [];

    // Resolved once per frame by the list's own hook, which the refresh pass
    // runs before any slot, then shared by every slot's presence check. Not
    // read at construction: like every element, the list is inert until its
    // first refresh, so an ancestor that skips it keeps `items` from running.
    let source: ListSource<T> = EMPTY_SOURCE;
    let currentLength = 0;

    container.onRefresh = growPool;

    return container;

    /** Builds any index below `length` that has no slot yet. */
    function growPool(): void {
        source = typeof items === 'function' ? items() : items;
        const length = source.length;
        currentLength = typeof length === 'function' ? length() : length;
        while (slots.length < currentLength) buildSlot(slots.length);
    }

    function buildSlot(index: number): void {
        // Safe even for an empty slot: construction evaluates no bindings, so
        // nothing reads the item until the slot's own refresh below.
        const slot = props.children(() => resolved[index] as T, index);

        // The slot's presence check runs before its own refresh, so no item
        // binding ever runs for an empty slot. When present, the item view's
        // own refresh then runs as normal, including a `visible` binding of its
        // own, which can only hide an occupied slot further.
        const ownRefresh = slot.onRefresh;
        slot.onRefresh = () => {
            const current = index < currentLength ? source.at(index) : undefined;
            resolved[index] = current;
            const isPresent = current !== undefined;
            slot.visible = isPresent; // Pixi's setter early-outs when unchanged
            if (!isPresent) return SKIP_DESCENDANTS;
            return ownRefresh?.();
        };

        slots.push(slot);
        container.addChild(slot);

        // Built mid-pass, so the running pass will not visit it until next
        // frame, and until its first refresh its bindings have not run at all.
        // Refresh it now so it is correct on the frame it appears.
        refreshScene(slot);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Stands in for the source until the list's first refresh resolves it. */
const EMPTY_SOURCE: ListSource<never> = { length: 0, at: () => undefined };
