# 079 Prototype: Source

The working prototype of [task 079](task.md)'s API, as it stood on 2026-10-25, copied from a scratch lab outside the repo (the lab was in a temporary folder, so this is the record). It is kept as Markdown so that the repo's lint and test runs leave it alone.

> **It predates the decisions of 2026-10-29.** Bring it up to [the task's design](task.md#the-design) when porting
> it. The differences:
>
> - **Shapes.** `createComputed` takes arrays (`ArraySource`, the `pair` type check, and the demo's `stoppedCount`):
>   it must refuse them, saying to use a record. `stoppedCount` becomes a getter that loops. `createReaction` already
>   refuses records, but its array form accepts mixed types: every element must give the same type.
> - **Typing.** `createReaction` and `createComputed` use overloads: each becomes one signature, as recorded in the
>   task's [Typing](task.md#typing) section, which also lists the cases its type tests must cover.
> - **`when` and the index.** `Condition` takes `(current, previous)`: it gains the index as a third parameter for
>   arrays. One getter's `react` doesn't declare it.
> - **No `all` and `any`.** Drop both from `conditions.ts`, the barrel, and the test that combines them: a condition
>   combines several by hand.
> - **`===`.** `isSame` treats `NaN` as equal to itself: replace it with `===`.
> - **Every primitive.** `Watchable` leaves out `bigint` and `symbol`: add both. `checkWatchable` already lets them
>   through, since it refuses only objects and functions. A `bigint` gets `increased` and `decreased`: the slot sets
>   them when both values are numbers or both are bigints, `WatchedOf` gives `WatchedNumber` for `number | bigint`,
>   and the `increased` and `decreased` conditions become generic, `<T extends number | bigint>`.
> - **Lazy computed values.** `createComputed` reads its sources at construction, through `createSources`: it reads
>   them on its first read instead.
> - **Empty sources.** Nothing checks them: an empty literal is a type error, an empty record throws, and an array
>   empty at run time does nothing.
> - **Computed objects aren't sources.** `core.ts` marks computed values and compares their version, and `Getter`
>   includes `Computed<unknown>`: drop both, so every source is a getter of a primitive. A computed object is watched
>   with `() => cells.version`. The tests and demo that watch a computed object (`watch(cells)`, the `relayout`
>   reaction, and `createComputed({ watch: grid })`) change to match.
> - **`watch`'s typing.** Its signature is already single, but it must refuse empty literals, and refuse a key named
>   `anyChanged` with a message rather than the `NoReservedName` intersection: see the task's [Typing](task.md#typing).
>   One getter's reading has no `anyChanged`, so `WatchedRecord.anyChanged` and the line in `sync` that sets it go.
> - **The primitives check on changes only.** `readKey` calls `checkWatchable` on every read: call it at
>   construction and when a read differs from the last, and keep it in production builds.
> - **Rename `WatchedRecord`.** It's the library's mutable state for one slot, for every shape of source, but its name
>   says "the reading of a record source", a different concept that sits right beside it. That will mislead every
>   reader. Rename it for what it is, such as `SlotState`.
>
> The prototype also had an `each` key for lists whose items come and go (`list.ts`, and `each` overloads on both
> factories). It was removed on 2026-10-29, when watching such lists was ruled out of scope for these tools: see the
> task's [List Handling](task.md#list-handling). The demo now watches the reels as a fixed array.

It ran on Node 26, which runs TypeScript directly: imports name their `.ts` files. Its tests use Node's own test runner (`node --test`), and the type checks ran under TypeScript 5.9.3 with `strict`, `verbatimModuleSyntax`, `allowImportingTsExtensions` and `erasableSyntaxOnly`. Formatted by Prettier 3.9.10 at 120 columns and 4 spaces. It does not follow every repo convention (it uses double quotes, and `null` in `Watchable` without an `eslint-disable`); porting it is part of the task.

- [src/api/index.ts](#srcapiindexts)
- [src/api/core.ts](#srcapicorets)
- [src/api/watch.ts](#srcapiwatchts)
- [src/api/conditions.ts](#srcapiconditionsts)
- [src/api/reaction.ts](#srcapireactionts)
- [src/api/computed.ts](#srcapicomputedts)
- [src/api/watch.test.ts](#srcapiwatchtestts)
- [src/api/reaction.test.ts](#srcapireactiontestts)
- [src/api/computed.test.ts](#srcapicomputedtestts)
- [src/api-type-checks.ts](#srcapi-type-checksts)
- [src/fixtures.ts](#srcfixturests)
- [src/demo.ts](#srcdemots)

## src/api/index.ts

The barrel.

```ts
export { all, any, changedFrom, decreased, increased, type Condition, type When } from "./conditions.ts";
export { createComputed, type Compute } from "./computed.ts";
export type { Computed, Getter, Watchable, Watched, WatchedNumber } from "./core.ts";
export { createReaction, type Reaction } from "./reaction.ts";
export { watch, type Reading, type Watcher } from "./watch.ts";
```

## src/api/core.ts

Types, and the slot that watches one value.

```ts
// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A value safe to compare with `===`: what a getter you watch must return. */
export type Watchable = string | number | boolean | null | undefined;

/** Marks a computed value, so that a watch compares its version rather than the value itself. */
export const COMPUTED: unique symbol = Symbol("computed");

/**
 * A computed value. Call it to read the value. It computes on its first read, and again on a later read
 * only if something it watches has changed.
 */
export interface Computed<R> {
    (): R;
    /**
     * How many times the value has changed. Reading it brings the value up to date first. A primitive
     * value's version rises only when the value changes. An object's rises every time it's recomputed,
     * because an object maintained in place can't be compared with what it was.
     */
    readonly version: number;
    readonly [COMPUTED]: true;
}

/** A getter of a watchable value, such as a binding. */
export type Getter<T extends Watchable = Watchable> = () => T;

/** One value to watch: a getter, or a computed value. */
export type ValueSource = Getter | Computed<unknown>;

/** Several values to watch, by name. */
export type RecordSource = { readonly [name: string]: ValueSource };

/** Several values to watch, by position. */
export type ArraySource = readonly ValueSource[];

/** What a source gives: the getter's value, or the computed value. */
export type ValueOf<S> = S extends () => infer T ? T : never;

/** What a watch knows about one value, since the last time it read it. */
export interface Watched<T> {
    readonly current: T;
    /** The value before. Equal to `current` when nothing changed. */
    readonly previous: T;
    readonly changed: boolean;
    /** Whether it changed, to `value`. */
    readonly changedTo: (value: T) => boolean;
    /** Whether it changed, from `value`. */
    readonly changedFrom: (value: T) => boolean;
}

/** A watched number: it also says which way it moved. */
export interface WatchedNumber<T extends number = number> extends Watched<T> {
    readonly increased: boolean;
    readonly decreased: boolean;
}

export type WatchedOf<T> = [T] extends [number] ? WatchedNumber<T & number> : Watched<T>;

// ---------------------------------------------------------------------------
// Internals, shared by watch, createReaction and createComputed
// ---------------------------------------------------------------------------

/** A watched value's record, as the library writes it. */
export interface WatchedRecord {
    current: unknown;
    previous: unknown;
    changed: boolean;
    increased: boolean;
    decreased: boolean;
    /** The same as `changed`: what a one-value watch's reading reports as `anyChanged`. */
    anyChanged: boolean;
    readonly changedTo: (value: unknown) => boolean;
    readonly changedFrom: (value: unknown) => boolean;
}

/** One watched value: its record, and how to read it again. */
export interface Slot {
    readonly watched: WatchedRecord;
    /** Reads the source again. Returns whether it changed since the last read. */
    readonly sync: () => boolean;
}

export function isComputed(value: unknown): value is Computed<unknown> {
    return typeof value === "function" && (value as { readonly [COMPUTED]?: true })[COMPUTED] === true;
}

/**
 * Makes a slot for one source, and reads it now: a watch's first `previous` is the value at construction,
 * so a change is always a change that was seen, never the watch being set up.
 */
export function createSlot(source: ValueSource, name: string): Slot {
    const computed = isComputed(source) ? source : undefined;
    const getter = source as () => unknown;
    // What is compared: the value itself, or a computed value's version
    let key = readKey();
    const watched: WatchedRecord = {
        current: readValue(),
        previous: undefined,
        changed: false,
        increased: false,
        decreased: false,
        anyChanged: false,
        changedTo: (value) => watched.changed && watched.current === value,
        changedFrom: (value) => watched.changed && watched.previous === value,
    };
    watched.previous = watched.current;
    return { watched, sync };

    function readKey(): unknown {
        return computed === undefined ? checkWatchable(getter(), name) : computed.version;
    }

    function readValue(): unknown {
        return computed === undefined ? key : computed();
    }

    function sync(): boolean {
        const nextKey = readKey();
        const changed = !isSame(nextKey, key);
        key = nextKey;
        const last = watched.current;
        const next = changed ? readValue() : last;
        watched.previous = last;
        watched.current = next;
        watched.changed = changed;
        watched.anyChanged = changed;
        const isNumberChange = changed && typeof next === "number" && typeof last === "number";
        watched.increased = isNumberChange && (next as number) > (last as number);
        watched.decreased = isNumberChange && (next as number) < (last as number);
        return changed;
    }
}

/** `===`, except that `NaN` equals itself, so that a watched `NaN` isn't a change on every read. */
export function isSame(a: unknown, b: unknown): boolean {
    return a === b || (a !== a && b !== b);
}

/** Returns `value`, or throws if it's an object or a function, which `===` can't watch. */
export function checkWatchable(value: unknown, name: string): unknown {
    if (value !== null && (typeof value === "object" || typeof value === "function")) {
        throw new Error(
            `[watch] ${name} gave ${Array.isArray(value) ? "an array" : `a ${typeof value}`}, which can't be watched: ` +
                "a change inside it would keep it equal to itself. Watch a primitive, such as a count or a revision, " +
                "or compute it with createComputed and watch that.",
        );
    }
    return value;
}
```

## src/api/watch.ts

The core: `watch` and `poll()`.

```ts
import {
    createSlot,
    isComputed,
    type ArraySource,
    type RecordSource,
    type Slot,
    type ValueOf,
    type ValueSource,
    type WatchedOf,
    type WatchedRecord,
} from "./core.ts";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What `poll()` returns: a `Watched` for each source, and whether any of them changed. For one source,
 * the reading is that source's `Watched`.
 */
export type Reading<S> = S extends ArraySource
    ? { readonly [I in keyof S]: WatchedOf<ValueOf<S[I]>> } & AnyChanged
    : S extends ValueSource
      ? WatchedOf<ValueOf<S>> & AnyChanged
      : S extends RecordSource
        ? { readonly [K in keyof S]: WatchedOf<ValueOf<S[K]>> } & AnyChanged
        : never;

export interface AnyChanged {
    /** Whether any watched value changed. */
    readonly anyChanged: boolean;
}

/** The current values of the sources: one value, or a record or array of them. */
export type ValuesOf<S> = S extends ArraySource
    ? { readonly [I in keyof S]: ValueOf<S[I]> }
    : S extends ValueSource
      ? ValueOf<S>
      : S extends RecordSource
        ? { readonly [K in keyof S]: ValueOf<S[K]> }
        : never;

export interface Watcher<S> {
    /**
     * Reads every source, and compares each with what it was at the last poll, or at construction for the
     * first poll. Poll once per step. The reading is updated in place, so don't keep it between steps.
     */
    readonly poll: () => Reading<S>;
}

/** A record source can't use the reading's own name. */
type NoReservedName<S> = S extends RecordSource ? { readonly anyChanged?: never } : unknown;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Watches one value, or a record or array of them, for changes, for logic inside a step. Each source is
 * read now, as the baseline, so the first poll reports only what changed since construction.
 *
 * ```ts
 * const watcher = watch({ phase: bindings.phase, lives: bindings.lives });
 * // in refresh:
 * const w = watcher.poll();
 * if (w.phase.changedTo("dying")) sound.play(SHIP_EXPLODE);
 * if (w.lives.decreased) flashLives();
 * ```
 */
export function watch<const S extends ValueSource | RecordSource | ArraySource>(
    sources: S & NoReservedName<S>,
): Watcher<S> {
    const { reading, sync } = createSources(sources, "watch");
    return {
        poll: () => {
            sync();
            return reading as Reading<S>;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals, shared with createReaction and createComputed
// ---------------------------------------------------------------------------

export interface Sources {
    /** The reading `poll()` returns. */
    readonly reading: unknown;
    /** The current values, updated in place: one value, or a record or array of them. */
    readonly values: () => unknown;
    /** Reads every source. Returns whether any changed. */
    readonly sync: () => boolean;
}

export function createSources(sources: unknown, name: string): Sources {
    if (typeof sources === "function") return createValueSources(sources as ValueSource, name);
    if (Array.isArray(sources)) return createArraySources(sources as ArraySource, name);
    if (typeof sources === "object" && sources !== null) return createRecordSources(sources as RecordSource, name);
    throw new Error(
        `[${name}] Watches a getter, a computed value, or a record or array of them, not ${String(sources)}.`,
    );
}

function createValueSources(source: ValueSource, name: string): Sources {
    const slot = createSlot(source, name);
    return { reading: slot.watched, values: () => slot.watched.current, sync: slot.sync };
}

function createArraySources(sources: ArraySource, name: string): Sources {
    const slots: Slot[] = [];
    const values: unknown[] = [];
    const watched: WatchedRecord[] = [];
    for (let i = 0; i < sources.length; i++) {
        const slot = createSlot(checkSource(sources[i], `${name}[${i}]`), `${name}[${i}]`);
        slots.push(slot);
        watched.push(slot.watched);
        values.push(slot.watched.current);
    }
    const reading = Object.assign(watched, { anyChanged: false });
    return { reading, values: () => values, sync };

    function sync(): boolean {
        let anyChanged = false;
        for (let i = 0; i < slots.length; i++) {
            if (slots[i].sync()) {
                anyChanged = true;
                values[i] = slots[i].watched.current;
            }
        }
        reading.anyChanged = anyChanged;
        return anyChanged;
    }
}

function createRecordSources(sources: RecordSource, name: string): Sources {
    if ("anyChanged" in sources)
        throw new Error(`[${name}] A source can't be called "anyChanged": the reading uses that name.`);
    const keys = Object.keys(sources);
    const slots: Slot[] = [];
    const values: Record<string, unknown> = {};
    const reading: Record<string, unknown> & { anyChanged: boolean } = { anyChanged: false };
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const slot = createSlot(checkSource(sources[key], `${name}.${key}`), `${name}.${key}`);
        slots.push(slot);
        reading[key] = slot.watched;
        values[key] = slot.watched.current;
    }
    return { reading, values: () => values, sync };

    function sync(): boolean {
        let anyChanged = false;
        for (let i = 0; i < slots.length; i++) {
            if (slots[i].sync()) {
                anyChanged = true;
                values[keys[i]] = slots[i].watched.current;
            }
        }
        reading.anyChanged = anyChanged;
        return anyChanged;
    }
}

function checkSource(source: unknown, name: string): ValueSource {
    if (typeof source !== "function" && !isComputed(source)) {
        throw new Error(`[${name}] Each source must be a getter or a computed value.`);
    }
    return source as ValueSource;
}
```

## src/api/conditions.ts

Conditions for `when`.

```ts
import type { Watchable } from "./core.ts";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Whether a change from `previous` to `current` should run a reaction's effect. */
export type Condition<T> = (current: T, previous: T) => boolean;

/** What `when` takes: a value, meaning "changed to it", or a condition. */
export type When<T> = (T extends Watchable ? T : never) | Condition<T>;

/** The number went up. */
export const increased: Condition<number> = (current, previous) => current > previous;

/** The number went down. */
export const decreased: Condition<number> = (current, previous) => current < previous;

/** The value changed from `value`. (For "changed to", give `when` the value itself.) */
export function changedFrom<T extends Watchable>(value: NoInfer<T>): Condition<T> {
    return (_current, previous) => previous === value;
}

/** Every one of the values or conditions matches. */
export function all<T>(...conditions: readonly When<NoInfer<T>>[]): Condition<T> {
    return (current, previous) => {
        for (let i = 0; i < conditions.length; i++) {
            if (!matches(conditions[i], current, previous)) return false;
        }
        return true;
    };
}

/** At least one of the values or conditions matches. */
export function any<T>(...conditions: readonly When<NoInfer<T>>[]): Condition<T> {
    return (current, previous) => {
        for (let i = 0; i < conditions.length; i++) {
            if (matches(conditions[i], current, previous)) return true;
        }
        return false;
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Whether a change matches a value (it changed to it) or a condition. */
export function matches<T>(when: When<T>, current: T, previous: T): boolean {
    return typeof when === "function" ? (when as Condition<T>)(current, previous) : current === when;
}
```

## src/api/reaction.ts

`createReaction`.

```ts
import { matches, type When } from "./conditions.ts";
import { createSlot, type Slot, type ValueOf, type ValueSource } from "./core.ts";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A reaction: call it on every step, unconditionally. It runs its `react` function each time it sees a
 * change that `when` accepts. It never runs because it was made: it reads what it watches at
 * construction, as the baseline. Calling it twice in a step is harmless: the second call sees no change.
 */
export type Reaction = () => void;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Reacts to each value of a fixed array, separately: one reaction for each, sharing `when` and `react`. */
export function createReaction<const S extends readonly ValueSource[]>(options: {
    readonly watch: S;
    readonly when?: When<NoInfer<ValueOf<S[number]>>>;
    readonly react: (current: ValueOf<S[number]>, previous: ValueOf<S[number]>, index: number) => void;
}): Reaction;
/** Reacts to one value: a getter, or a computed value. */
export function createReaction<S extends ValueSource>(options: {
    readonly watch: S;
    readonly when?: When<NoInfer<ValueOf<S>>>;
    readonly react: (current: ValueOf<S>, previous: ValueOf<S>) => void;
}): Reaction;
export function createReaction(options: ReactionOptions): Reaction {
    const hasWhen = "when" in options;
    if (hasWhen && options.when === undefined) {
        throw new Error(
            "[createReaction] `when: undefined` is ambiguous: leave `when` out to react to every change, " +
                "or write `when: (current) => current === undefined` to react to a change to undefined.",
        );
    }
    const when = options.when as When<unknown>;
    const react = options.react;

    const source = options.watch;
    if (Array.isArray(source)) {
        const slots: Slot[] = [];
        for (let i = 0; i < source.length; i++) {
            slots.push(createSlot(source[i] as ValueSource, `createReaction watch[${i}]`));
        }
        return () => {
            for (let i = 0; i < slots.length; i++) {
                if (slots[i].sync()) onSlotChange(slots[i].watched.current, slots[i].watched.previous, i);
            }
        };
    }

    if (typeof source === "function") {
        const slot = createSlot(source as ValueSource, "createReaction watch");
        const watched = slot.watched;
        return () => {
            if (slot.sync() && (!hasWhen || matches(when, watched.current, watched.previous))) {
                (react as (current: unknown, previous: unknown) => void)(watched.current, watched.previous);
            }
        };
    }

    throw new Error(
        "[createReaction] `watch` takes one value, or an array of values. To react to several values together, " +
            "compute one value from them with createComputed, and react to that.",
    );

    function onSlotChange(current: unknown, previous: unknown, index: number): void {
        if (!hasWhen || matches(when, current, previous)) react(current, previous, index);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The options as the implementation sees them, before the overloads' types are applied. */
interface ReactionOptions {
    readonly watch: unknown;
    readonly when?: unknown;
    readonly react: (current: unknown, previous: unknown, index: number) => void;
}
```

## src/api/computed.ts

`createComputed`.

```ts
import { COMPUTED, type ArraySource, type Computed, type RecordSource, type ValueSource } from "./core.ts";
import { createSources, type ValuesOf } from "./watch.ts";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * How a computed value is computed, from the current values of what it watches. It must depend only on
 * what it's given.
 *
 * To maintain an object rather than rebuild it, declare a second parameter with a default: the default
 * makes the object on the first compute, and every later compute is given the last result. Update it in
 * place and return it; the version still rises, so watchers still see the change.
 *
 * ```ts
 * compute: (size, cells = createCells()) => resize(cells, size)
 * ```
 *
 * The second parameter is deliberately left out of this type. That way it takes its type from its
 * default, and the result is inferred with no annotations. Declaring it here would make TypeScript fix
 * the result type before reading the default, and the result would become `unknown`.
 */
export type Compute<C, R> = (current: C) => R;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Computes a value from one value, or a record or array of them. It computes on its first read, and on a
 * later read only if something it watches changed.
 */
export function createComputed<const S extends ValueSource | RecordSource | ArraySource, R>(options: {
    readonly watch: S;
    readonly compute: Compute<ValuesOf<S>, R>;
}): Computed<R>;
export function createComputed(options: ComputedOptions): Computed<unknown> {
    const compute = options.compute as (current: unknown, last: unknown) => unknown;
    const { sync, values } = createSources(options.watch, "createComputed");

    let hasResult = false;
    let result: unknown;
    let version = 0;
    let isComputing = false;

    const computed = (() => {
        update();
        return result;
    }) as Computed<unknown>;
    Object.defineProperty(computed, "version", { get: () => (update(), version) });
    Object.defineProperty(computed, COMPUTED, { value: true });
    return computed;

    function update(): void {
        if (isComputing) throw new Error("[createComputed] A computed value read itself while it was being computed.");
        const changed = sync();
        if (hasResult && !changed) return;
        isComputing = true;
        try {
            // On the first compute, `last` is undefined, so a default parameter makes the object to maintain
            const next = compute(values(), result);
            // A primitive changes when its value does. An object can't be compared with what it was, so
            // every recompute counts as a change
            if (!hasResult || next !== result || isObjectLike(next)) version++;
            result = next;
            hasResult = true;
        } finally {
            isComputing = false;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The options as the implementation sees them, before the overloads' types are applied. */
interface ComputedOptions {
    readonly watch: unknown;
    readonly compute: (current: never, last: never) => unknown;
}

function isObjectLike(value: unknown): boolean {
    return value !== null && (typeof value === "object" || typeof value === "function");
}
```

## src/api/watch.test.ts

Tests: `watch`.

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createComputed, watch } from "./index.ts";

describe("watch", () => {
    it("reads its sources at construction, so the first poll reports only what changed since", () => {
        let score = 10;
        const watcher = watch(() => score);
        const first = watcher.poll();
        assert.equal(first.changed, false);
        assert.equal(first.current, 10);
        assert.equal(first.previous, 10);

        score = 20;
        const second = watcher.poll();
        assert.equal(second.changed, true);
        assert.equal(second.current, 20);
        assert.equal(second.previous, 10);
        assert.equal(second.increased, true);
        assert.equal(second.decreased, false);
    });

    it("sees a change made between construction and the first poll", () => {
        let beats = 0;
        const watcher = watch(() => beats);
        beats = 1;
        assert.equal(watcher.poll().increased, true);
    });

    it("says what a value changed to and from", () => {
        let phase = "playing";
        const watcher = watch(() => phase);
        phase = "dying";
        const w = watcher.poll();
        assert.equal(w.changedTo("dying"), true);
        assert.equal(w.changedTo("playing"), false);
        assert.equal(w.changedFrom("playing"), true);
        // Nothing changed on the next poll, so nothing changed to anything
        assert.equal(watcher.poll().changedTo("dying"), false);
    });

    it("watches a record by name, and reports whether anything changed", () => {
        let cols = 4;
        let rows = 3;
        const watcher = watch({ cols: () => cols, rows: () => rows });
        assert.equal(watcher.poll().anyChanged, false);
        rows = 5;
        const w = watcher.poll();
        assert.equal(w.anyChanged, true);
        assert.equal(w.cols.changed, false);
        assert.equal(w.rows.changed, true);
        assert.equal(w.rows.current, 5);
    });

    it("watches an array by position", () => {
        let a = 1;
        let b = "x";
        const watcher = watch([() => a, () => b]);
        b = "y";
        const w = watcher.poll();
        assert.equal(w.anyChanged, true);
        assert.equal(w[0].changed, false);
        assert.equal(w[1].changedTo("y"), true);
    });

    it("treats NaN as equal to itself, so it isn't a change on every poll", () => {
        const watcher = watch(() => Number.NaN);
        assert.equal(watcher.poll().changed, false);
    });

    it("watches a computed value by its version, and reports the value itself", () => {
        let cols = 2;
        const cells = createComputed({
            watch: () => cols,
            compute: (n, array: number[] = []) => {
                array.length = n;
                return array;
            },
        });
        const watcher = watch(cells);
        assert.equal(watcher.poll().changed, false);
        cols = 3;
        const w = watcher.poll();
        assert.equal(w.changed, true);
        // Maintained in place, so the same array, but its version rose
        assert.equal(w.current, w.previous);
        assert.equal(w.current.length, 3);
    });

    it("refuses a getter that returns an object, which === can't watch", () => {
        assert.throws(() => watch(() => [1, 2, 3] as unknown as number), /an array, which can't be watched/);
    });

    it("refuses a source called anyChanged", () => {
        // @ts-expect-error The reading uses that name.
        assert.throws(() => watch({ anyChanged: () => 1 }), /can't be called "anyChanged"/);
    });
});
```

## src/api/reaction.test.ts

Tests: `createReaction`.

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { all, any, changedFrom, createComputed, createReaction, increased } from "./index.ts";

describe("createReaction", () => {
    it("never reacts because it was made, only when it sees a change", () => {
        let phase = "dying";
        const played: string[] = [];
        const playDeath = createReaction({ watch: () => phase, when: "dying", react: () => played.push("explode") });
        playDeath();
        assert.deepEqual(played, []);

        phase = "respawning";
        playDeath();
        phase = "dying";
        playDeath();
        assert.deepEqual(played, ["explode"]);
    });

    it("reacts to every change when there's no `when`, with the value before", () => {
        let phase = "a";
        const seen: string[] = [];
        const follow = createReaction({
            watch: () => phase,
            react: (current, previous) => seen.push(`${previous}>${current}`),
        });
        phase = "b";
        follow();
        phase = "c";
        follow();
        assert.deepEqual(seen, ["a>b", "b>c"]);
    });

    it("sees nothing on a second call in the same step", () => {
        let spins = 0;
        let count = 0;
        const playLever = createReaction({ watch: () => spins, when: increased, react: () => count++ });
        spins = 1;
        playLever();
        playLever();
        assert.equal(count, 1);
    });

    it("plays once for each shot missed, from previous to current", () => {
        let shots = 0;
        let fired = 0;
        const playShots = createReaction({
            watch: () => shots,
            when: increased,
            react: (current, previous) => {
                for (let i = previous; i < current; i++) fired++;
            },
        });
        shots = 3;
        playShots();
        assert.equal(fired, 3);
    });

    it("combines values and conditions with all and any", () => {
        let phase = "playing";
        const heard: string[] = [];
        const playRespawn = createReaction({
            watch: () => phase,
            when: all(changedFrom("dying"), "respawning"),
            react: () => heard.push("respawn"),
        });
        const playLoss = createReaction({
            watch: () => phase,
            when: any("dying", "game-over"),
            react: () => heard.push("loss"),
        });
        const step = (next: string): void => {
            phase = next;
            playRespawn();
            playLoss();
        };
        step("respawning");
        step("dying");
        step("respawning");
        step("game-over");
        assert.deepEqual(heard, ["loss", "respawn", "loss"]);
    });

    it("throws on `when: undefined`, which would silently mean any change", () => {
        assert.throws(() => createReaction({ watch: () => 1, when: undefined, react: () => {} }), /ambiguous/);
    });

    it("reacts to each value of an array separately", () => {
        const phases = ["spinning", "spinning", "spinning"];
        const stops: number[] = [];
        const playStops = createReaction({
            watch: [() => phases[0], () => phases[1], () => phases[2]],
            when: "settling",
            react: (_current, _previous, index) => stops.push(index),
        });
        phases[1] = "settling";
        playStops();
        phases[0] = "settling";
        phases[2] = "settling";
        playStops();
        assert.deepEqual(stops, [1, 0, 2]);
    });

    it("reacts to a computed primitive by its value", () => {
        let active = false;
        let level = 1;
        let alarms = 0;
        const isInDanger = createComputed({
            watch: { active: () => active, level: () => level },
            compute: (v) => v.active && v.level > 3,
        });
        const playAlarm = createReaction({ watch: isInDanger, when: true, react: () => alarms++ });
        active = true;
        playAlarm();
        level = 5;
        playAlarm();
        level = 6;
        playAlarm();
        assert.equal(alarms, 1);
    });

    it("refuses a record, which has no clear meaning for a reaction", () => {
        // @ts-expect-error A record is for createComputed.
        assert.throws(() => createReaction({ watch: { a: () => 1 }, react: () => {} }), /compute one value/);
    });
});
```

## src/api/computed.test.ts

Tests: `createComputed`.

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createComputed, createReaction } from "./index.ts";

describe("createComputed", () => {
    it("computes on its first read, then only when something it watches changes", () => {
        let score = 10;
        let computes = 0;
        const scoreText = createComputed({ watch: () => score, compute: (s) => (computes++, `SCORE ${s}`) });
        assert.equal(computes, 0);
        assert.equal(scoreText(), "SCORE 10");
        assert.equal(scoreText(), "SCORE 10");
        assert.equal(computes, 1);
        score = 20;
        assert.equal(scoreText(), "SCORE 20");
        assert.equal(computes, 2);
    });

    it("recomputes when any value of a record changes", () => {
        let cols = 2;
        let rows = 2;
        const grid = createComputed({
            watch: { cols: () => cols, rows: () => rows },
            compute: ({ cols, rows }) => `${cols}x${rows}`,
        });
        assert.equal(grid(), "2x2");
        rows = 3;
        assert.equal(grid(), "2x3");
    });

    it("maintains an object made by a default parameter, updated in place, and still says it changed", () => {
        let size = 2;
        let creates = 0;
        const makeCells = (): number[] => (creates++, []);
        const cells = createComputed({
            watch: () => size,
            compute: (n, array: number[] = makeCells()) => {
                while (array.length < n) array.push(0);
                array.length = n;
                return array;
            },
        });
        const first = cells();
        const firstVersion = cells.version;
        size = 4;
        const second = cells();
        assert.equal(second, first);
        assert.equal(second.length, 4);
        assert.equal(creates, 1);
        assert.equal(cells.version, firstVersion + 1);
    });

    it("raises a primitive's version only when the value changes", () => {
        let score = 1200;
        const level = createComputed({ watch: () => score, compute: (s) => Math.floor(s / 1000) });
        const before = level.version;
        score = 1500;
        assert.equal(level.version, before);
        score = 2100;
        assert.equal(level.version, before + 1);
    });

    it("lets a reaction see a recompute of an object maintained in place", () => {
        let size = 1;
        let layouts = 0;
        const cells = createComputed({
            watch: () => size,
            compute: (n, array: number[] = []) => {
                array.length = n;
                return array;
            },
        });
        const relayout = createReaction({ watch: cells, react: () => layouts++ });
        size = 2;
        relayout();
        relayout();
        assert.equal(layouts, 1);
    });

    it("chains: a computed value can watch another", () => {
        let score = 0;
        const level = createComputed({ watch: () => score, compute: (s) => Math.floor(s / 100) });
        const label = createComputed({ watch: level, compute: (l) => `LEVEL ${l}` });
        assert.equal(label(), "LEVEL 0");
        score = 250;
        assert.equal(label(), "LEVEL 2");
    });

    it("is safe to read any number of times, in any step", () => {
        let x = 1;
        const doubled = createComputed({ watch: () => x, compute: (n) => n * 2 });
        x = 2;
        assert.equal(doubled(), 4);
        assert.equal(doubled(), 4);
        assert.equal(doubled.version, doubled.version);
    });

    it("throws if it reads itself while computing", () => {
        const looped: { value?: () => number } = {};
        const self = createComputed({ watch: () => 1, compute: () => (looped.value?.() ?? 0) + 1 });
        looped.value = self;
        assert.throws(() => self(), /read itself/);
    });
});
```

## src/api-type-checks.ts

Type checks: exact inferred types, and mistakes the types catch.

```ts
// The built API's types: what each form infers (any `false` is an error), and the mistakes it catches
// (each `@ts-expect-error` must have an error below it). Type-checked only, never run.

import { bindings, heartbeat, model, type GamePhase, type Grid, type ReelPhase } from "./fixtures.ts";
import {
    all,
    any,
    changedFrom,
    createComputed,
    createReaction,
    decreased,
    increased,
    watch,
    type Computed,
    type Reaction,
} from "./api/index.ts";

type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;
const yes = <T extends true>(): T => true as T;
declare function buildGrid(cols: number, rows: number): Grid;
type Cells = { readonly values: number[] };
declare function createCells(): Cells;
declare function resize(cells: Cells, size: number): Cells;

// ---- createReaction: one value ----
createReaction({
    watch: bindings.phase,
    when: "dying",
    react: (current, previous) => {
        yes<Equal<typeof current, GamePhase>>();
        yes<Equal<typeof previous, GamePhase>>();
    },
});
createReaction({
    watch: bindings.spins,
    when: increased,
    react: (current, previous) => {
        yes<Equal<typeof current, number>>();
        yes<Equal<typeof previous, number>>();
    },
});
createReaction({ watch: () => heartbeat.count, when: decreased, react: () => {} });
createReaction({ watch: bindings.phase, when: all(changedFrom("dying"), "respawning"), react: () => {} });
createReaction({ watch: bindings.phase, when: any("dying", "game-over"), react: () => {} });
createReaction({ watch: bindings.level, when: (level, previous) => level - previous >= 5, react: () => {} });
// Any key order infers the same
createReaction({
    react: (current) => {
        yes<Equal<typeof current, GamePhase>>();
    },
    when: "dying",
    watch: bindings.phase,
});

// ---- createReaction: a fixed array ----
createReaction({
    watch: model.reels.map((reel) => () => reel.phase),
    when: "settling",
    react: (current, _previous, index) => {
        yes<Equal<typeof current, ReelPhase>>();
        yes<Equal<typeof index, number>>();
    },
});

// ---- createComputed ----
const scoreText = createComputed({ watch: bindings.score, compute: (score) => `SCORE ${score}` });
yes<Equal<typeof scoreText, Computed<string>>>();
const grid = createComputed({
    watch: { cols: bindings.cols, rows: bindings.rows },
    compute: ({ cols, rows }) => buildGrid(cols, rows),
});
yes<Equal<typeof grid, Computed<Grid>>>();
const pair = createComputed({
    watch: [bindings.cols, bindings.phase],
    compute: ([cols, phase]) => {
        yes<Equal<typeof cols, number>>();
        yes<Equal<typeof phase, GamePhase>>();
        return `${cols} ${phase}`;
    },
});
yes<Equal<typeof pair, Computed<string>>>();
const width = createComputed({ watch: grid, compute: (g) => g.length });
yes<Equal<typeof width, Computed<number>>>();
const relayout: Reaction = createReaction({
    watch: grid,
    react: (current) => {
        yes<Equal<typeof current, Grid>>();
    },
});

// ---- createComputed: maintaining an object, with a typed default for `last` ----
const cells = createComputed({
    watch: bindings.cols,
    compute: (size, cells: Cells = createCells()) => resize(cells, size),
});
yes<Equal<typeof cells, Computed<Cells>>>();
// Typing the return instead of the parameter works too
const cells2 = createComputed({
    watch: bindings.cols,
    compute: (size, cells = createCells()): Cells => resize(cells, size),
});
yes<Equal<typeof cells2, Computed<Cells>>>();

// ---- watch ----
const w = watch({ phase: bindings.phase, lives: bindings.spins }).poll();
yes<Equal<typeof w.phase.current, GamePhase>>();
yes<Equal<typeof w.lives.increased, boolean>>();
yes<Equal<typeof w.anyChanged, boolean>>();
const single = watch(bindings.phase).poll();
yes<Equal<typeof single.previous, GamePhase>>();

// ---- Mistakes ----
// @ts-expect-error 'bounce' is not a GamePhase.
createReaction({ watch: bindings.phase, when: "bounce", react: () => {} });
// @ts-expect-error 'bounce' is not a GamePhase.
createReaction({ watch: bindings.phase, when: any("dying", "bounce"), react: () => {} });
// @ts-expect-error `increased` needs a number.
createReaction({ watch: bindings.phase, when: increased, react: () => {} });
// @ts-expect-error A record is for createComputed: react to one value computed from it.
createReaction({ watch: { cols: bindings.cols, rows: bindings.rows }, react: () => {} });
// @ts-expect-error An array can't be watched through a getter.
createReaction({ watch: () => model.reels, react: () => {} });
// @ts-expect-error A computation has no condition.
createComputed({ watch: bindings.score, when: increased, compute: (score) => score });
// @ts-expect-error `phase` has no `increased`: it isn't a number.
watch(bindings.phase).poll().increased;
// @ts-expect-error A reaction's `react` is required.
createReaction({ watch: bindings.phase, when: "dying" });
// @ts-expect-error Using `last` needs a default, so the object always exists.
createComputed({ watch: bindings.cols, compute: (size, cells: Cells) => resize(cells, size) });
// A default with no type at all also infers: the second parameter takes its type from the default
const cells3 = createComputed({ watch: bindings.cols, compute: (size, cells = createCells()) => resize(cells, size) });
yes<Equal<typeof cells3, Computed<Cells>>>();
createComputed({
    watch: bindings.cols,
    compute: (size, cells = createCells()) => {
        yes<Equal<typeof cells, Cells>>();
        return resize(cells, size);
    },
});

export { relayout, scoreText };
```

## src/fixtures.ts

Fixtures the type checks watch.

```ts
// Things to watch in the examples: a model, a view's bindings, and a sound chip. Declarations only.

export type GamePhase = 'playing' | 'dying' | 'respawning' | 'wave-clear' | 'game-over';
export type ReelPhase = 'stopped' | 'spinning' | 'settling';
export type SoundEffect = { readonly name: string };
export type Grid = readonly (readonly number[])[];

export interface Reel {
    readonly phase: ReelPhase;
    readonly position: number;
}

/** A model, as a top-level view sees it: plain properties, and actions that aren't watchable. */
export interface GameModel {
    readonly phase: GamePhase;
    readonly score: number;
    readonly shotsFired: number;
    readonly cols: number;
    readonly rows: number;
    readonly reels: readonly Reel[];
    readonly spin: () => void;
    readonly aimAt: (x: number) => void;
}

/** A leaf view's bindings: getters. */
export interface HudBindings {
    readonly score: () => number;
    readonly phase: () => GamePhase;
    readonly spins: () => number;
    readonly shotsFired: () => number;
    readonly isActive: () => boolean;
    readonly level: () => number;
    readonly cols: () => number;
    readonly rows: () => number;
}

export declare const model: GameModel;
export declare const bindings: HudBindings;
export declare const sound: { readonly play: (effect: SoundEffect) => void };
export declare const heartbeat: { readonly count: number };
export declare const badge: { visible: boolean };
export declare const badgeText: { text: string };

export declare const SHIP_EXPLODE: SoundEffect;
export declare const RESPAWN: SoundEffect;
export declare const LEVER: SoundEffect;
export declare const FIRE: SoundEffect;
export declare const ALARM: SoundEffect;
export declare const BEAT: SoundEffect;

export declare function buildGrid(cols: number, rows: number): Grid;
export declare function refreshLayout(grid: Grid): void;
export declare function chooseReelStop(index: number): SoundEffect;
export declare function formatScore(score: number): string;
export declare function draw(...values: readonly unknown[]): void;
```

## src/demo.ts

Demo: a tiny fruit machine and its sound.

```ts
// A tiny fruit machine and its sound, run step by step. Run it with `npm run demo`.
// Change the model or the reactions and run it again to see what plays when.

import { all, changedFrom, createComputed, createReaction, increased, watch } from "./api/index.ts";

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

type MachinePhase = "idle" | "spinning" | "celebrating" | "game-over";
type ReelPhase = "spinning" | "settling" | "stopped";

interface Reel {
    readonly phase: ReelPhase;
}

function createMachine() {
    let phase: MachinePhase = "idle";
    let spins = 0;
    let credits = 3;
    let lastWin = 0;
    let phaseMs = 0;
    const reels = [
        { phase: "stopped" as ReelPhase },
        { phase: "stopped" as ReelPhase },
        { phase: "stopped" as ReelPhase },
    ];

    return {
        get phase() {
            return phase;
        },
        get spins() {
            return spins;
        },
        get credits() {
            return credits;
        },
        get lastWin() {
            return lastWin;
        },
        reels: reels as readonly Reel[],
        spin(): void {
            if (phase !== "idle") return;
            phase = "spinning";
            phaseMs = 0;
            spins++;
            credits--;
            for (const reel of reels) reel.phase = "spinning";
        },
        update(deltaMs: number): void {
            phaseMs += deltaMs;
            if (phase === "spinning") {
                // Each reel settles 400 ms after the one before, and stops 200 ms after it settles
                for (let i = 0; i < reels.length; i++) {
                    if (reels[i].phase === "spinning" && phaseMs >= 1000 + i * 400) reels[i].phase = "settling";
                    if (reels[i].phase === "settling" && phaseMs >= 1200 + i * 400) reels[i].phase = "stopped";
                }
                if (reels.every((reel) => reel.phase === "stopped")) {
                    lastWin = spins % 2 === 0 ? 5 : 0;
                    credits += lastWin;
                    phase = lastWin > 0 ? "celebrating" : credits > 0 ? "idle" : "game-over";
                    phaseMs = 0;
                }
            } else if (phase === "celebrating" && phaseMs >= 800) {
                phase = "idle";
            }
        },
    };
}

// ---------------------------------------------------------------------------
// The views: sound and a HUD, which only print here
// ---------------------------------------------------------------------------

const machine = createMachine();
let nowMs = 0;
const log = (text: string): void => console.log(`${String(nowMs).padStart(6)} ms  ${text}`);
const sound = { play: (name: string): void => log(`♪ ${name}`) };

// Reactions: one moment each
const playLever = createReaction({ watch: () => machine.spins, when: increased, react: () => sound.play("LEVER") });
const playStops = createReaction({
    watch: machine.reels.map((reel) => () => reel.phase),
    when: "settling",
    react: (_phase, _previous, index) => sound.play(`REEL ${index + 1} STOP`),
});
const playWin = createReaction({
    watch: () => machine.phase,
    when: "celebrating",
    react: () => sound.play(`WIN ${machine.lastWin}`),
});
const playNoWin = createReaction({
    watch: () => machine.phase,
    when: all(changedFrom("spinning"), "idle"),
    react: () => sound.play("NO WIN"),
});
const playGameOver = createReaction({
    watch: () => machine.phase,
    when: "game-over",
    react: () => sound.play("GAME OVER"),
});

// Computed values, and a reaction to one
const creditsText = createComputed({ watch: () => machine.credits, compute: (credits) => `CREDITS ${credits}` });
const stoppedCount = createComputed({
    watch: machine.reels.map((reel) => () => reel.phase),
    compute: (phases) => phases.filter((phase) => phase === "stopped").length,
});
const showCredits = createReaction({ watch: creditsText, react: (text) => log(`[hud] ${text}`) });

// Logic inside the step, with watch
const stopped = watch(stoppedCount);

// A reaction never runs because it was made, so the HUD draws its first state itself
log(`[hud] ${creditsText()}`);

function refresh(): void {
    playLever();
    playStops();
    playWin();
    playNoWin();
    playGameOver();
    showCredits();
    const reels = stopped.poll();
    if (reels.increased && reels.current === machine.reels.length) log("[hud] all reels stopped");
}

// ---------------------------------------------------------------------------
// The loop: a player pulls the lever whenever the machine is idle, every 2.5 seconds
// ---------------------------------------------------------------------------

for (nowMs = 0; nowMs <= 12_000 && machine.phase !== "game-over"; nowMs += 100) {
    if (machine.phase === "idle" && nowMs % 2500 === 0) machine.spin();
    machine.update(100);
    refresh();
}
```
