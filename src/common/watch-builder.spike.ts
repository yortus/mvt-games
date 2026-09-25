// ---------------------------------------------------------------------------
// SPIKE: `Watch()` fluent builder
// ---------------------------------------------------------------------------
// Exploratory prototype (not wired into `#common`). A single top-level builder
// whose chain reads like an English description of the operation:
//
//   Watch().when(() => phase).changes({ from: 'play', to: 'dead' }).then(flash)
//   Watch().eachOf(() => enemies).when((e) => e.level > 10).changes({ to: true }).then(...)
//
// Grammar
//   Watch()
//     .when(() => value)           -> SINGLE mode: one primitive value
//     .when({ a, b })              -> SET mode:    a named record of triggers
//     .eachOf(() => list).when((item, index) => value)  -> LIST mode
//         .detect()                -> detector: poll it and check changes yourself
//         .derive(initial, fn)     -> memoised structure
//         .changes({ from?, to? })   -> reaction filter (argless: any change)
//             .then(action)        -> reaction
//
//   One rule everywhere: a value's first poll is a change from *nothing*. So the
//   first poll reports `changed` (with `previous` undefined), `derive` computes,
//   and a reaction fires if its filter accepts it. In list mode the rule applies
//   per slot, to each slot's first poll.
//
//   A change needs a new value. A `from` filter also needs a previous value, and
//   the first poll has none, so a `from` filter never fires on the first poll.
//   `from: PREVIOUS` asks for nothing more - "any change after the first poll" -
//   for effects that must not fire on construction, like sounds. Any `from`
//   narrows `previous` to `V`.
//
//   Reaction callbacks share one argument order - `(value, previous)` for single
//   mode, `(value, previous, item, index)` for list mode (item before index, as in
//   `array.map((item, index) => ...)`) - so the two are prefix-compatible.
//
// The condition (`when`) is the SAME in every mode: any `Watchable` value under
// `===` change detection, with the same `changes` filter. List mode
// adds nothing to the *condition* - it only widens the callbacks with the item,
// its index, and the previous value.
//
// The unifying contract: every terminal (`detect`, `derive`, `then`) is
// pull-based and exposes `poll()`. You construct once and poll every frame from
// `refresh()` / `update()`.
//
// Hot-path discipline: no per-poll allocation. State and result objects are
// pre-allocated once and mutated in place.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Values safe for `===` change detection. Excludes objects and arrays. */
export type Watchable = string | number | boolean | null | undefined;

/** A record of named primitive getters (SET mode). */
export type WatchGetters = Record<string, () => Watchable>;

/** One change-detected value; `P` is the type of `previous`. */
export interface WatchedProperty<V, P = V | undefined> {
    readonly changed: boolean;
    readonly value: V;
    readonly previous: P;
}

/** Per-key watched values for a SET-mode watcher. */
export type WatchedValues<S extends WatchGetters> = {
    readonly [K in keyof S]: WatchedProperty<ReturnType<S[K]>>;
};

/** SET-mode watched values after `changes({ from: PREVIOUS })`: every key has a `previous`. */
export type WatchedValuesWithPrevious<S extends WatchGetters> = {
    readonly [K in keyof S]: WatchedProperty<ReturnType<S[K]>, ReturnType<S[K]>>;
};

/** A side effect gated on change. Poll it every frame; it fires on qualifying transitions. */
export interface Reaction {
    poll(): void;
}

/** A memoised value recomputed only when its input changes. */
export interface Derived<T> {
    /** Recompute if the input changed since the last poll, then return the value. */
    poll(): T;
    /** Whether the most recent `poll()` recomputed. */
    readonly changed: boolean;
}

/** A `from` value matching any previous value: "any change after the first poll". */
export const PREVIOUS: unique symbol = Symbol('PREVIOUS');

/** Transition filter. */
export interface ChangeFilter<V> {
    /**
     * Only fire when the previous value equalled this (`PREVIOUS`: any previous
     * value). Needs a previous value, so never matches the first poll.
     */
    from?: V | typeof PREVIOUS;
    /** Only fire when the new value equals this. */
    to?: V;
}

/** A filter with a `from`: whenever it fires, a previous value exists. */
export type ChangeFilterFrom<V> = ChangeFilter<V> & { from: V | typeof PREVIOUS };

// -- Detectors (the `.detect()` terminals) -----------------------------------

/** SINGLE mode detector. */
export interface Detector<V extends Watchable> {
    poll(): WatchedProperty<V>;
}

/** SET mode detector. */
export interface SetDetector<S extends WatchGetters> {
    poll(): WatchedValues<S>;
}

/** One item's change-detected value in LIST mode. */
export interface EachWatchedItem<T, V extends Watchable> extends WatchedProperty<V> {
    readonly item: T;
    readonly index: number;
}

/** LIST mode watched values: aggregate counts plus per-index access. */
export interface EachWatchedValues<T, V extends Watchable> {
    readonly count: number;
    readonly changedCount: number;
    readonly anyChanged: boolean;
    /** The watched item at `index` (valid for `0 <= index < count`). */
    at(index: number): EachWatchedItem<T, V>;
}

/** LIST mode detector. */
export interface EachDetector<T, V extends Watchable> {
    poll(): EachWatchedValues<T, V>;
}

// -- Root --------------------------------------------------------------------

export interface WatchRoot {
    /** SINGLE mode: `select` returns the primitive to watch. */
    when<V extends Watchable>(select: () => V): SingleBuilder<V>;
    /** SET mode: a named record of triggers; reactions fire when any changes. */
    when<S extends WatchGetters>(selectors: S): SetBuilder<S>;
    /** LIST mode: switch to watching a uniform (shortish) list. */
    eachOf<T>(list: () => readonly T[]): EachSelector<T>;
}

// -- Single mode -------------------------------------------------------------

/** A SINGLE-mode reaction callback; `P` is the type of `previous`. */
export type SingleAction<V extends Watchable, P = V | undefined> = (value: V, previous: P) => void;

export interface SingleThen<V extends Watchable, P = V | undefined> {
    then(action: SingleAction<V, P>): Reaction;
}

export interface SingleBuilder<V extends Watchable> {
    /** Detect changes and check them yourself; no reaction attached. */
    detect(): Detector<V>;
    /** Derive a memoised value; `compute` runs whenever the value changes. */
    derive<T>(initial: T, compute: (derived: T, value: V, previous: V | undefined) => T): Derived<T>;
    /** Filter which changes fire (argless: any change); any `from` narrows `previous` to `V`. */
    changes(filter: ChangeFilterFrom<V>): SingleThen<V, V>;
    changes(filter?: ChangeFilter<V>): SingleThen<V>;
}

// -- Set mode (record of triggers) -------------------------------------------

/** A SET-mode reaction callback: the per-key watched values. */
export type SetAction<W> = (watched: W) => void;

export interface SetThen<W> {
    then(action: SetAction<W>): Reaction;
}

export interface SetBuilder<S extends WatchGetters> {
    /** Detect changes and check the per-key watched values yourself. */
    detect(): SetDetector<S>;
    /** Derive a memoised value; `compute` runs whenever any key changes. */
    derive<T>(initial: T, compute: (derived: T, watched: WatchedValues<S>) => T): Derived<T>;
    /** Fire when any key changes; `{ from: PREVIOUS }` skips the first poll and narrows every `previous`. */
    changes(filter: { from: typeof PREVIOUS }): SetThen<WatchedValuesWithPrevious<S>>;
    changes(): SetThen<WatchedValues<S>>;
}

// -- List mode ---------------------------------------------------------------

/** A LIST-mode reaction callback: `SingleAction`'s args plus the item and its index. */
export type EachAction<T, V extends Watchable, P = V | undefined> = (
    value: V,
    previous: P,
    item: T,
    index: number,
) => void;

export interface EachThen<T, V extends Watchable, P = V | undefined> {
    then(action: EachAction<T, V, P>): Reaction;
}

export interface EachSelector<T> {
    /**
     * `select` reads one primitive per item; the condition is any `Watchable`.
     * Slots are tracked by array index: a slot's history belongs to its index,
     * not its item. Safe for in-place mutation, pools, `SlotList` and append-only
     * lists; removing or reordering mid-list compares shifted items against their
     * predecessor's history.
     */
    when<V extends Watchable>(select: (item: T, index: number) => V): EachBuilder<T, V>;
}

export interface EachBuilder<T, V extends Watchable> {
    /** Early-out: the raw list watcher (per-item watched values). */
    detect(): EachDetector<T, V>;
    /** Derive a memoised value; `compute` runs whenever any item changes. */
    derive<R>(initial: R, compute: (derived: R, watched: EachWatchedValues<T, V>) => R): Derived<R>;
    /** Filter which per-item changes fire (argless: any change); any `from` narrows `previous` to `V`. */
    changes(filter: ChangeFilterFrom<V>): EachThen<T, V, V>;
    changes(filter?: ChangeFilter<V>): EachThen<T, V>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function Watch(): WatchRoot {
    return watchRoot;
}

// ---------------------------------------------------------------------------
// Internals: root
// ---------------------------------------------------------------------------

const watchRoot: WatchRoot = {
    when: ((selector: unknown) =>
        typeof selector === 'function'
            ? createSingleBuilder(selector as () => Watchable)
            : createSetBuilder(selector as WatchGetters)) as WatchRoot['when'],
    eachOf: (list) => createEachSelector(list),
};

// ---------------------------------------------------------------------------
// Internals: shared
// ---------------------------------------------------------------------------

function createDerived<T>(initial: T, pollChanged: () => boolean, recompute: (derived: T) => T): Derived<T> {
    let value = initial;
    let changed = false;
    return {
        poll(): T {
            changed = pollChanged();
            if (changed) value = recompute(value);
            return value;
        },
        get changed(): boolean {
            return changed;
        },
    };
}

const acceptAnyChange = (): boolean => true;

function createFilterTest<V extends Watchable>(
    filter: ChangeFilter<V> | undefined,
): (value: V, previous: V | undefined, firstPoll: boolean) => boolean {
    if (filter === undefined) return acceptAnyChange;
    const hasFrom = 'from' in filter;
    const hasTo = 'to' in filter;
    const from = filter.from;
    const to = filter.to;
    const anyPrevious = from === PREVIOUS;
    return (value, previous, firstPoll) =>
        (!hasFrom || (!firstPoll && (anyPrevious || previous === from))) && (!hasTo || value === to);
}

// ---------------------------------------------------------------------------
// Internals: single mode
// ---------------------------------------------------------------------------

function createSingleBuilder<V extends Watchable>(select: () => V): SingleBuilder<V> {
    return {
        detect: () => createDetector(select),
        derive: (initial, compute) => {
            const detector = createDetector(select);
            const watched = detector.watched;
            return createDerived(
                initial,
                () => detector.poll().changed,
                (derived) => compute(derived, watched.value, watched.previous),
            );
        },
        // One runtime for both overloads; a `from` filter only narrows the type of `previous`.
        changes: ((filter?: ChangeFilter<V>) => ({
            then: (action: SingleAction<V>) => createSingleAction(select, filter, action),
        })) as SingleBuilder<V>['changes'],
    };
}

function createSingleAction<V extends Watchable>(
    select: () => V,
    filter: ChangeFilter<V> | undefined,
    action: SingleAction<V>,
): Reaction {
    const detector = createDetector(select);
    const accepts = createFilterTest(filter);
    return {
        poll(): void {
            const r = detector.poll();
            if (r.changed && accepts(r.value, r.previous, detector.firstPoll)) action(r.value, r.previous);
        },
    };
}

interface DetectorCore<V extends Watchable> extends Detector<V> {
    readonly watched: WatchedProperty<V>;
    /** Whether the most recent poll was the first. */
    firstPoll: boolean;
}

function createDetector<V extends Watchable>(select: () => V): DetectorCore<V> {
    const watched = {
        changed: false,
        value: undefined as unknown as V,
        previous: undefined as V | undefined,
    };
    // A flag, not a sentinel value, keeps `value`/`previous` monomorphic.
    let seen = false;
    const core: DetectorCore<V> = {
        watched,
        firstPoll: false,
        poll(): WatchedProperty<V> {
            const next = select();
            core.firstPoll = !seen;
            watched.changed = !seen || next !== watched.value;
            watched.previous = seen ? watched.value : undefined;
            watched.value = next;
            seen = true;
            return watched;
        },
    };
    return core;
}

// ---------------------------------------------------------------------------
// Internals: set mode (record of triggers)
// ---------------------------------------------------------------------------

interface SetState {
    changed: boolean;
    value: unknown;
    previous: unknown;
}

interface SetCore<S extends WatchGetters> {
    watched: WatchedValues<S>;
    /** Whether the most recent poll was the first. */
    firstPoll: boolean;
    /** Poll all getters; return how many changed. */
    poll(): number;
}

function createSetCore<S extends WatchGetters>(getters: S): SetCore<S> {
    const keys = Object.keys(getters) as (keyof S)[];
    const reads = keys.map((k) => getters[k]);
    const state: SetState[] = reads.map(() => ({ changed: false, value: undefined, previous: undefined }));
    const watched = Object.fromEntries(keys.map((k, i) => [k, state[i]])) as WatchedValues<S>;
    let seen = false;
    const core: SetCore<S> = {
        watched,
        firstPoll: false,
        poll(): number {
            core.firstPoll = !seen;
            let changedCount = 0;
            for (let i = 0; i < reads.length; ++i) {
                const next = reads[i]();
                const s = state[i];
                s.changed = !seen || next !== s.value;
                s.previous = seen ? s.value : undefined;
                s.value = next;
                if (s.changed) changedCount++;
            }
            seen = true;
            return changedCount;
        },
    };
    return core;
}

function createSetBuilder<S extends WatchGetters>(getters: S): SetBuilder<S> {
    const attach = (fromPrevious: boolean) => (action: SetAction<WatchedValues<S>>): Reaction => {
        const core = createSetCore(getters);
        return {
            poll(): void {
                if (core.poll() > 0 && !(fromPrevious && core.firstPoll)) action(core.watched);
            },
        };
    };
    return {
        detect: () => {
            const core = createSetCore(getters);
            return {
                poll(): WatchedValues<S> {
                    core.poll();
                    return core.watched;
                },
            };
        },
        derive: (initial, compute) => {
            const core = createSetCore(getters);
            return createDerived(initial, () => core.poll() > 0, (derived) => compute(derived, core.watched));
        },
        // `{ from: PREVIOUS }` only skips the first poll; `previous` is then typed present.
        changes: ((filter?: { from: typeof PREVIOUS }) => ({
            then: attach(filter !== undefined),
        })) as SetBuilder<S>['changes'],
    };
}

// ---------------------------------------------------------------------------
// Internals: list mode
// ---------------------------------------------------------------------------

function createEachSelector<T>(list: () => readonly T[]): EachSelector<T> {
    return { when: (select) => createEachBuilder(list, select) };
}

function createEachBuilder<T, V extends Watchable>(
    list: () => readonly T[],
    select: (item: T, index: number) => V,
): EachBuilder<T, V> {
    return {
        detect: () => {
            const core = createEachCore(list, select);
            return {
                poll(): EachWatchedValues<T, V> {
                    core.poll(undefined);
                    return core.watched;
                },
            };
        },
        derive: (initial, compute) => {
            const core = createEachCore(list, select);
            return createDerived(initial, () => core.poll(undefined) > 0, (derived) => compute(derived, core.watched));
        },
        changes: ((filter?: ChangeFilter<V>) => ({
            then: (action: EachAction<T, V>) => createEachAction(list, select, filter, action),
        })) as EachBuilder<T, V>['changes'],
    };
}

function createEachAction<T, V extends Watchable>(
    list: () => readonly T[],
    select: (item: T, index: number) => V,
    filter: ChangeFilter<V> | undefined,
    action: EachAction<T, V>,
): Reaction {
    const core = createEachCore(list, select);
    const accepts = createFilterTest(filter);
    const visit = (s: EachItemState<T, V>): void => {
        if (s.changed && accepts(s.value, s.previous, s.firstPoll)) action(s.value, s.previous, s.item, s.index);
    };
    return {
        poll(): void {
            core.poll(visit);
        },
    };
}

// -- Per-index list tracking -------------------------------------------------

interface EachItemState<T, V> {
    item: T;
    index: number;
    changed: boolean;
    value: V;
    previous: V | undefined;
    firstPoll: boolean;
}

interface EachCore<T, V extends Watchable> {
    watched: EachWatchedValues<T, V>;
    /** Poll every item, visiting each; return how many changed. */
    poll(visit: ((state: EachItemState<T, V>) => void) | undefined): number;
}

function createEachCore<T, V extends Watchable>(
    list: () => readonly T[],
    select: (item: T, index: number) => V,
): EachCore<T, V> {
    // Items are tracked by array index (slot). A slot at index >= `known` is
    // newly-seen this poll, so this is its first poll.
    const states: EachItemState<T, V>[] = [];
    let known = 0;
    let count = 0;
    let changedCount = 0;

    const watched: EachWatchedValues<T, V> = {
        get count() {
            return count;
        },
        get changedCount() {
            return changedCount;
        },
        get anyChanged() {
            return changedCount > 0;
        },
        at: (index) => states[index],
    };

    return {
        watched,
        poll(visit): number {
            const items = list();
            const n = items.length;
            changedCount = 0;
            for (let i = 0; i < n; ++i) {
                const item = items[i];
                const value = select(item, i);
                let s = states[i];
                if (s === undefined) {
                    s = { item, index: i, changed: false, value, previous: undefined, firstPoll: true };
                    states[i] = s;
                }
                const seen = i < known;
                s.changed = !seen || value !== s.value;
                s.previous = seen ? s.value : undefined;
                s.firstPoll = !seen;
                if (s.changed) changedCount++;
                s.item = item;
                s.index = i;
                s.value = value;
                if (visit !== undefined) visit(s);
            }
            known = n;
            count = n;
            return changedCount;
        },
    };
}
