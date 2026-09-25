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
 * Slots are built once and kept. A slot inside `length` whose item is absent
 * (a hole) is hidden and skips its subtree. Slots past `length` are detached,
 * so a list that was once long costs nothing for its unused tail, and are
 * reattached, not rebuilt, when the list grows back.
 *
 * See `proposals/004-list-proposal.md` for the design.
 */

import { Container } from 'pixi.js';
import { refreshScene, SKIP_DESCENDANTS } from '../pixi-mvt';
import { propReadCounter } from './prop-reads';

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
     * Call the accessor only inside bindings and refresh methods, never while
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
    // The `items` prop as passed: a source, or a getter returning one.
    const itemsProp = props.items;

    // High-water-mark pool: every slot ever built, by index, kept for reuse.
    // Slot `i` is child `i` for every `i` below `attachedCount`, which is the
    // list's length after each refresh. Slots at or past it are detached: a
    // parked tail of hidden slots would still cost a refresh call each per
    // frame. Holes below the length are hidden instead.
    const slots: Container[] = [];
    let attachedCount = 0;

    // Each slot's current item, by index. A slot's presence check looks its
    // item up once per frame and stores it here; every binding in the slot then
    // reads it back through the slot's `item()` accessor, without calling `at()`.
    const slotItems: (T | undefined)[] = [];

    // The source and its length, read once per frame by the list's own
    // `onRefresh`, which the refresh pass runs before any slot, then shared by
    // every slot's presence check. Not read at construction: like every
    // element, the list is inert until its first refresh, so an ancestor that
    // skips it keeps `items` from running.
    let currentSource: ListSource<T> = EMPTY_SOURCE;
    let currentLength = 0;

    container.onRefresh = fitToLength;
    // Detached slots are not the container's children, so destroying the
    // container would not reach them.
    container.on('destroyed', destroyDetachedSlots);

    return container;

    /** Attaches exactly the slots below `length`, building any that do not exist yet. */
    function fitToLength(): void {
        currentSource = typeof itemsProp === 'function' ? itemsProp() : itemsProp;
        const lengthOrGetter = currentSource.length;
        currentLength = typeof lengthOrGetter === 'function' ? lengthOrGetter() : lengthOrGetter;
        if (attachedCount > currentLength) detachTail();
        while (attachedCount < currentLength) attachSlot(attachedCount);
        // Prop reads: one of `items`, and one presence check per attached
        // slot, which every one of them runs this frame. Counted here, once,
        // rather than in the slot's refresh, where even an untaken branch
        // costs V8's inlining budget.
        if (propReadCounter.isCounting) propReadCounter.count += (1 + attachedCount);
    }

    function detachTail(): void {
        // Removed mid-pass: the refresh pass skips a container detached
        // earlier in the same pass, so none of these refresh this frame.
        container.removeChildren(currentLength, attachedCount);
        // Forget the detached slots' items, which would otherwise stay alive.
        slotItems.length = attachedCount = currentLength;
    }

    function attachSlot(index: number): void {
        const slot = index < slots.length ? slots[index] : buildSlot(index);
        container.addChild(slot);
        attachedCount++;

        // Attached mid-pass, so the running pass will not visit it until next
        // frame, and a new slot's bindings have not run at all yet. Refresh it
        // now so it is correct on the frame it appears.
        refreshScene(slot);
    }

    function destroyDetachedSlots(): void {
        for (let i = attachedCount; i < slots.length; i++) slots[i].destroy({ children: true });
    }

    function buildSlot(index: number): Container {
        // The accessor reads the item the slot's presence check stored. Safe
        // even for an empty slot: construction evaluates no bindings, so
        // nothing reads the item until the slot's own refresh below.
        const slot = props.children(() => slotItems[index] as T, index);

        // The slot's presence check runs before its own refresh, so no item
        // binding ever runs for an empty slot. When present, the item view's
        // own refresh then runs as normal, including a `visible` binding of its
        // own, which can only hide an occupied slot further.
        const itemViewRefresh = slot.onRefresh;
        // Whether the slot held an item at its last refresh; a new slot starts
        // visible, as Pixi containers do. Unchanged while detached, as is the
        // slot's `visible`, so the two still agree when it is reattached.
        let wasPresent = true;
        slot.onRefresh = () => {
            const item = index < currentLength ? currentSource.at(index) : undefined;
            slotItems[index] = item;
            const isPresent = item !== undefined;
            // Written only on a change of presence. The item view may hide an
            // occupied slot with a `visible` binding of its own; writing
            // `visible` back to true every frame would undo that and re-hide
            // it each frame, and every such flip makes Pixi rebuild the render
            // group. It also keeps the steady-state path free of setter calls.
            if (isPresent !== wasPresent) wasPresent = slot.visible = isPresent;
            if (!isPresent) return SKIP_DESCENDANTS;
            return itemViewRefresh?.();
        };

        slots.push(slot);
        return slot;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Stands in for the source until the list's first refresh resolves it. */
const EMPTY_SOURCE: ListSource<never> = { length: 0, at: () => undefined };
