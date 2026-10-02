/**
 * Index-addressed `<List>` function component, for any JSX target.
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
 * An item view must not keep item data it read at construction time: slot `i`
 * will later hold a different item. Everything item-dependent must be a
 * getter, which is why `children` receives an accessor rather than a value.
 *
 * A slot's item view is built once, the first time the slot holds an item, and
 * kept. Until then the slot is an empty placeholder. A slot inside `length`
 * whose item is absent (a hole) is hidden and skips its subtree. Slots past
 * `length` are detached, so a list that was once long costs nothing for its
 * unused tail, and are reattached, not rebuilt, when the list grows back.
 *
 * See `notes/archive/004-list-proposal.md` for the design.
 */

import { readCounter } from '../read-counter';
import { setTickMethods } from '../scene-passes';
import { SKIP_DESCENDANTS } from '../skip-descendants';
import type { JsxTarget } from './jsx-target';

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
    at: (index: number) => T | undefined;
}

/** The bindings of a `<List>` whose JSX target's nodes are `N`. */
export interface ListBindings<T, N> {
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
     * first frame the slot holds an item.
     *
     * The accessor returns that item while the view is being built, so the view
     * may read it to set itself up. Later items reach the view only through its
     * bindings and refresh methods, so anything read at construction must also
     * be followed there. An empty slot skips its whole subtree, so no binding
     * sees an absent item.
     */
    children: (item: () => T, index: number) => N;
    /**
     * The node to build the slots into, in place of a new group: for example
     * an HTML `<ul>`, so `ul > li` selectors still match. It must be empty:
     * the list owns its children, and adds and detaches them as it sees fit.
     */
    container?: N;
    /** Handle on the list's own container, e.g. to set Pixi's `sortableChildren`. */
    ref?: (el: N) => void;
}

/** A `<List>` for a JSX target whose nodes are `N`. */
export type ListComponent<N> = <T>(bindings: ListBindings<T, N>) => N;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for {@link createList}. */
export interface ListOptions<N extends object> {
    /** The renderer's scene graph, as the base needs it. */
    readonly target: JsxTarget<N>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Makes the `<List>` component for a JSX target. */
export function createList<N extends object>(options: ListOptions<N>): ListComponent<N> {
    const target = options.target;
    const setVisible = target.visible.apply;

    return List;

    function List<T>(bindings: ListBindings<T, N>): N {
        const container = bindings.container ?? target.createGroup();
        // The `items` binding as passed: a source, or a getter returning one.
        const itemsBinding = bindings.items;

        // High-water-mark pool: every slot ever built, by index, kept for reuse.
        // Slot `i` is child `i` for every `i` below `attachedCount`, which is the
        // list's length after each refresh. Slots at or past it are detached: a
        // parked tail of hidden slots would still cost a refresh call each per
        // frame. Holes below the length are hidden instead.
        const slots: N[] = [];
        let attachedCount = 0;

        // Each slot's current item, by index. A slot's presence check looks its
        // item up once per frame and stores it here; every binding in the slot then
        // reads it back through the slot's `item()` accessor, without calling `at()`.
        const slotItems: (T | undefined)[] = [];

        // The source and its length, read once per frame by the list's own
        // refresh method, which the refresh scene pass runs before any slot,
        // then shared by every slot's presence check. Not read at construction: like every
        // element, the list is inert until its first refresh, so an ancestor that
        // skips it keeps `items` from running.
        let currentSource: ListSource<T> = EMPTY_SOURCE;
        let currentLength = 0;

        setTickMethods(container, { refresh: fitToLength });
        // Detached slots are not the container's children, so destroying the
        // container would not reach them.
        target.onDestroyed(container, destroyDetachedSlots);

        return container;

        /** Attaches exactly the slots below `length`, building any that do not exist yet. */
        function fitToLength(): void {
            currentSource = typeof itemsBinding === 'function' ? itemsBinding() : itemsBinding;
            const lengthOrGetter = currentSource.length;
            currentLength = typeof lengthOrGetter === 'function' ? lengthOrGetter() : lengthOrGetter;
            if (attachedCount > currentLength) detachTail();
            while (attachedCount < currentLength) attachSlot(attachedCount);
            // Reads: one of `items`, and one presence check per attached
            // slot, which every one of them runs this frame. Counted here, once,
            // rather than in the slot's refresh, where even an untaken branch
            // costs V8's inlining budget.
            if (readCounter.isCounting) readCounter.count += (1 + attachedCount);
        }

        function detachTail(): void {
            // Removed during a scene pass, which skips a node detached earlier
            // in the same scene pass, so none of these refresh this frame.
            target.detachTail(container, attachedCount - currentLength);
            // Forget the detached slots' items, which would otherwise stay alive.
            slotItems.length = attachedCount = currentLength;
        }

        function attachSlot(index: number): void {
            const slot = index < slots.length ? slots[index] : buildSlot(index);
            // Attached during a scene pass, which refreshes it before it returns,
            // so it is correct on the frame it appears.
            target.append(container, slot);
            attachedCount++;
        }

        function destroyDetachedSlots(): void {
            for (let i = attachedCount; i < slots.length; i++) target.destroy(slots[i]);
        }

        /**
         * Builds slot `index`: its item view if the slot holds an item now, or a
         * placeholder that builds the item view once it does. Either way the item
         * view is built with its item already in place, so it may read the item
         * while it is being built.
         */
        function buildSlot(index: number): N {
            const item = currentSource.at(index);
            const slot = item === undefined ? buildPlaceholder(index) : buildItemView(index, item);
            slots.push(slot);
            return slot;
        }

        /**
         * An empty, hidden stand-in for a slot that has never held an item. It keeps
         * slot `i` as child `i`, and runs the slot's presence check; the first time
         * the slot holds an item, it builds the item view and puts it in its place.
         */
        function buildPlaceholder(index: number): N {
            const placeholder = target.createGroup();
            setVisible(placeholder, false);
            setTickMethods(placeholder, {
                refresh: () => {
                    const item = index < currentLength ? currentSource.at(index) : undefined;
                    if (item === undefined) return;
                    const slot = buildItemView(index, item);
                    slots[index] = slot;
                    // Swapped during a scene pass, as an attached slot is: the scene pass
                    // skips the detached placeholder, and refreshes the new slot before
                    // it returns.
                    target.replace(container, placeholder, slot);
                    target.destroy(placeholder);
                },
            });
            return placeholder;
        }

        function buildItemView(index: number, item: T): N {
            // The accessor reads the item the slot's presence check stored. Stored
            // here first too, so the item view can read its item while it is being
            // built.
            slotItems[index] = item;
            const slot = bindings.children(() => slotItems[index] as T, index);

            // The slot's presence check wraps the item view's own refresh and runs
            // before it, so no item binding ever runs for an empty slot. When
            // present, the item view's own refresh then runs as normal, including a
            // `visible` binding of its own, which can only hide an occupied slot
            // further.
            // Whether the slot held an item at its last refresh; a new slot starts
            // visible, as every JSX target's nodes do. Unchanged while detached, as is
            // the slot's visibility, so the two still agree when it is reattached.
            let wasPresent = true;
            setTickMethods(slot, {
                refresh: (itemViewRefresh) => {
                    const item = index < currentLength ? currentSource.at(index) : undefined;
                    slotItems[index] = item;
                    const isPresent = item !== undefined;
                    // Written only on a change of presence. The item view may hide an
                    // occupied slot with a `visible` binding of its own; writing
                    // visibility back to true every frame would undo that and re-hide
                    // it each frame, and on Pixi every such flip rebuilds the render
                    // group. It also keeps the steady-state path free of writes.
                    if (isPresent !== wasPresent) {
                        wasPresent = isPresent;
                        setVisible(slot, isPresent);
                    }
                    if (!isPresent) return SKIP_DESCENDANTS;
                    return itemViewRefresh?.();
                },
            });
            return slot;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Stands in for the source until the list's first refresh resolves it. */
const EMPTY_SOURCE: ListSource<never> = { length: 0, at: () => undefined };
