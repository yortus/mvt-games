import { describe, it, expect, vi } from 'vitest';
import { Watch, PREVIOUS } from './watch-builder.spike.ts';

// ---------------------------------------------------------------------------
// Tests: SPIKE `Watch()` builder
// ---------------------------------------------------------------------------

describe('Watch (spike)', () => {
    // -- Single: .detect() ---------------------------------------------------
    describe('Watch().when(getter).detect() - detector', () => {
        it('treats the first poll as a change from nothing', () => {
            let phase = 'play';
            const w = Watch().when(() => phase).detect();

            const first = w.poll();
            expect(first.changed).toBe(true);
            expect(first.value).toBe('play');
            expect(first.previous).toBe(undefined);

            expect(w.poll().changed).toBe(false);

            phase = 'dead';
            const third = w.poll();
            expect(third.changed).toBe(true);
            expect(third.previous).toBe('play');
        });

        it('counts a value that starts undefined as a first-poll change', () => {
            let selected = undefined as string | undefined;
            const w = Watch().when(() => selected).detect();

            const first = w.poll();
            expect(first.changed).toBe(true);
            expect(first.value).toBe(undefined);
            expect(first.previous).toBe(undefined);

            expect(w.poll().changed).toBe(false);
            selected = 'a';
            expect(w.poll().changed).toBe(true);
        });
    });

    // -- Single: .derive() ---------------------------------------------------
    describe('Watch().when(getter).derive() - memoisation', () => {
        it('computes on the first poll, then only when the value changes', () => {
            let n = 3;
            const compute = vi.fn((_derived: number, value: number) => value * value);
            const d = Watch().when(() => n).derive(0, compute);

            expect(d.poll()).toBe(9);
            expect(d.poll()).toBe(9);
            expect(compute).toHaveBeenCalledTimes(1);
            expect(d.changed).toBe(false);

            n = 4;
            expect(d.poll()).toBe(16);
            expect(compute).toHaveBeenCalledTimes(2);
            expect(d.changed).toBe(true);
        });
    });

    // -- Single: reactions ---------------------------------------------------
    describe('Watch().when(getter) reactions', () => {
        it('.changes().then() fires on the first poll and on every change', () => {
            let value = 0;
            const action = vi.fn();
            const r = Watch().when(() => value).changes().then(action);

            r.poll();
            value = 1;
            r.poll();
            r.poll(); // unchanged

            expect(action).toHaveBeenCalledTimes(2);
            expect(action).toHaveBeenNthCalledWith(1, 0, undefined);
            expect(action).toHaveBeenNthCalledWith(2, 1, 0);
        });

        it('.changes({ from, to }) never matches the first poll when `from` is set', () => {
            let value = 'a';
            const action = vi.fn();
            const r = Watch().when(() => value).changes({ from: 'b', to: 'c' }).then(action);

            r.poll(); // undefined -> 'a': wrong from
            value = 'b';
            r.poll(); // a -> b: wrong from
            expect(action).not.toHaveBeenCalled();

            value = 'c';
            r.poll(); // b -> c: matches from AND to
            expect(action).toHaveBeenCalledTimes(1);
            expect(action).toHaveBeenCalledWith('c', 'b');
        });

        it('.changes({ from: undefined }) matches leaving undefined, never the first poll', () => {
            let target = undefined as string | undefined;
            const action = vi.fn();
            const r = Watch().when(() => target).changes({ from: undefined }).then(action);

            r.poll(); // first poll of undefined - no previous to match
            expect(action).not.toHaveBeenCalled();

            target = 'enemy-3'; // acquired
            r.poll();
            expect(action).toHaveBeenCalledWith('enemy-3', undefined);
        });

        it('.changes({ to }) fires on the first poll when already that value', () => {
            const phase = 'dead';
            const action = vi.fn();
            Watch().when(() => phase).changes({ to: 'dead' }).then(action).poll();

            expect(action).toHaveBeenCalledWith('dead', undefined);
        });

        it('.changes({ to }) otherwise fires on the transition to it', () => {
            let phase = 'play';
            const action = vi.fn();
            const r = Watch().when(() => phase).changes({ to: 'dead' }).then(action);

            r.poll();
            phase = 'pause';
            r.poll();
            expect(action).not.toHaveBeenCalled();

            phase = 'dead';
            r.poll();
            expect(action).toHaveBeenCalledTimes(1);
            expect(action).toHaveBeenCalledWith('dead', 'pause');
        });

        it('.changes({ from: PREVIOUS }) fires on any change after the first poll', () => {
            let slot = 0;
            const action = vi.fn();
            const r = Watch().when(() => slot).changes({ from: PREVIOUS }).then(action);

            r.poll(); // first poll: a change, but no previous
            expect(action).not.toHaveBeenCalled();

            slot = 1;
            r.poll();
            expect(action).toHaveBeenCalledWith(1, 0);
        });

        it('.changes({ from: PREVIOUS, to }) ignores the value at construction - AudioView pattern', () => {
            let phase = 'dead';
            const action = vi.fn();
            const r = Watch().when(() => phase).changes({ from: PREVIOUS, to: 'dead' }).then(action);

            r.poll(); // constructed while already dead - no sound
            expect(action).not.toHaveBeenCalled();

            phase = 'play';
            r.poll();
            phase = 'dead';
            r.poll();
            expect(action).toHaveBeenCalledTimes(1);
            expect(action).toHaveBeenCalledWith('dead', 'play');
        });
    });

    // -- Type narrowing via `from` -------------------------------------------
    describe('any `from` filter narrows previous to V', () => {
        it('single mode', () => {
            let value = 'a';
            const seen: number[] = [];
            const r = Watch().when(() => value).changes({ from: PREVIOUS }).then((_v, previous) => seen.push(previous.length));
            Watch().when(() => value).changes({ from: 'a', to: 'b' }).then((_v, previous) => previous.length);
            // @ts-expect-error - without `from`, the first poll has no previous
            Watch().when(() => value).changes().then((_v, previous) => previous.length);
            // @ts-expect-error - a `to`-only filter fires on the first poll
            Watch().when(() => value).changes({ to: 'x' }).then((_v, previous) => previous.length);

            r.poll();
            value = 'bbb';
            r.poll();
            expect(seen).toEqual([1]);
        });

        it('set mode', () => {
            let score = 1;
            const seen: string[] = [];
            const r = Watch().when({ score: () => score }).changes({ from: PREVIOUS }).then((w) => seen.push(w.score.previous.toFixed()));
            // @ts-expect-error - without `from`, the first poll has no previous
            Watch().when({ score: () => score }).changes().then((w) => w.score.previous.toFixed());

            r.poll();
            score = 2;
            r.poll();
            expect(seen).toEqual(['1']);
        });

        it('list mode', () => {
            const items = [{ name: 'a' }];
            const seen: number[] = [];
            const r = Watch().eachOf(() => items).when((i) => i.name).changes({ from: PREVIOUS }).then((_v, previous) => seen.push(previous.length));
            // @ts-expect-error - without `from`, each slot's first poll has no previous
            Watch().eachOf(() => items).when((i) => i.name).changes().then((_v, previous) => previous.length);

            r.poll();
            items[0].name = 'bb';
            r.poll();
            expect(seen).toEqual([1]);
        });
    });

    // -- Set mode (record of triggers) ---------------------------------------
    describe('Watch().when(record) - set mode', () => {
        it('.detect() reports every key changed on the first poll', () => {
            let rows = 3;
            const cols = 4;
            const w = Watch().when({ rows: () => rows, cols: () => cols }).detect();

            const first = w.poll();
            expect(first.rows.changed).toBe(true);
            expect(first.cols.changed).toBe(true);
            expect(first.rows.previous).toBe(undefined);

            rows = 5;
            const second = w.poll();
            expect(second.rows.changed).toBe(true);
            expect(second.rows.previous).toBe(3);
            expect(second.cols.changed).toBe(false);
        });

        it('.derive() computes on the first poll and when ANY trigger changes', () => {
            let a = 1;
            let b = 1;
            const compute = vi.fn((_derived: number, w: { a: { value: number }; b: { value: number } }) => w.a.value + w.b.value);
            const d = Watch().when({ a: () => a, b: () => b }).derive(0, compute);

            expect(d.poll()).toBe(2); // first poll computes
            expect(d.poll()).toBe(2); // nothing changed - cached
            expect(compute).toHaveBeenCalledTimes(1);

            b = 5;
            expect(d.poll()).toBe(6); // b changed - recomputes
            expect(compute).toHaveBeenCalledTimes(2);

            a = 10;
            expect(d.poll()).toBe(15); // a changed - recomputes
            expect(compute).toHaveBeenCalledTimes(3);
        });

        it('.changes().then() fires on the first poll and when any key changes', () => {
            const score = 0;
            let combo = 0;
            const action = vi.fn();
            const r = Watch().when({ score: () => score, combo: () => combo }).changes().then(action);

            r.poll();
            expect(action).toHaveBeenCalledTimes(1);

            combo = 3;
            r.poll();
            expect(action).toHaveBeenCalledTimes(2);

            r.poll(); // nothing changed
            expect(action).toHaveBeenCalledTimes(2);
        });

        it('.changes({ from: PREVIOUS }).then() stays silent until a key changes', () => {
            let combo = 0;
            const action = vi.fn();
            const r = Watch().when({ combo: () => combo }).changes({ from: PREVIOUS }).then(action);

            r.poll();
            expect(action).not.toHaveBeenCalled();

            combo = 1;
            r.poll();
            expect(action).toHaveBeenCalledTimes(1);
        });
    });

    // -- List: same condition semantics as single mode -----------------------
    describe('Watch().eachOf(...).when(...) - list mode', () => {
        it('.changes({ to: true }) fires per item, including items already true on their first poll', () => {
            const enemies = [{ level: 1 }, { level: 5 }, { level: 20 }];
            const hits: number[] = [];
            const r = Watch()
                .eachOf(() => enemies)
                .when((e) => e.level > 10)
                .changes({ to: true })
                .then((_value, _previous, _item, index) => hits.push(index));

            r.poll(); // index 2: undefined -> true
            expect(hits).toEqual([2]);

            enemies[0].level = 11;
            enemies[1].level = 15;
            r.poll();
            expect(hits).toEqual([2, 0, 1]);

            r.poll();
            expect(hits).toEqual([2, 0, 1]);
        });

        it('.changes({ from: PREVIOUS, to }) skips each item\'s first poll so only real crossings fire', () => {
            const enemies = [{ level: 1 }, { level: 5 }, { level: 20 }];
            const hits: number[] = [];
            const r = Watch()
                .eachOf(() => enemies)
                .when((e) => e.level > 10)
                .changes({ from: PREVIOUS, to: true })
                .then((_value, _previous, _item, index) => hits.push(index));

            r.poll();
            expect(hits).toEqual([]);

            enemies[0].level = 11;
            enemies[1].level = 15;
            r.poll();
            expect(hits).toEqual([0, 1]);
        });

        it('.changes({ from, to }) works with a non-boolean value', () => {
            const units = [{ state: 'idle' }, { state: 'idle' }];
            const seen: string[] = [];
            const r = Watch()
                .eachOf(() => units)
                .when((u) => u.state)
                .changes({ from: 'idle', to: 'active' })
                .then((_value, _previous, _item, index) => seen.push(`${index}`));

            r.poll(); // undefined -> idle: wrong from
            units[0].state = 'moving'; // idle -> moving: wrong to
            r.poll();
            expect(seen).toEqual([]);

            units[1].state = 'active'; // idle -> active: matches
            r.poll();
            expect(seen).toEqual(['1']);
        });

        it('.changes().then() passes value, previous, item and index', () => {
            const items = [{ id: 'a', score: 0 }, { id: 'b', score: 0 }];
            const calls: string[] = [];
            const r = Watch()
                .eachOf(() => items)
                .when((i) => i.score)
                .changes()
                .then((value, previous, item, index) => calls.push(`${item.id}#${index}:${previous}->${value}`));

            r.poll();
            items[1].score = 9;
            r.poll();
            expect(calls).toEqual(['a#0:undefined->0', 'b#1:undefined->0', 'b#1:0->9']);
        });

        it('treats a newly-added slot\'s first poll like any value\'s', () => {
            const items: { on: boolean }[] = [{ on: false }];
            const hits: number[] = [];
            const r = Watch()
                .eachOf(() => items)
                .when((i) => i.on)
                .changes({ to: true })
                .then((_value, _previous, _item, index) => hits.push(index));

            r.poll();
            items.push({ on: true }); // brand-new slot, already true
            r.poll();
            expect(hits).toEqual([1]);
        });

        it('.changes({ from: PREVIOUS, to }) skips a newly-added slot\'s first poll too', () => {
            const items: { on: boolean }[] = [{ on: false }];
            const hits: number[] = [];
            const r = Watch()
                .eachOf(() => items)
                .when((i) => i.on)
                .changes({ from: PREVIOUS, to: true })
                .then((_value, _previous, _item, index) => hits.push(index));

            r.poll();
            items.push({ on: true });
            r.poll();
            expect(hits).toEqual([]);
        });
    });

    // -- List: .detect() (per-item watched values) ---------------------------
    describe('Watch().eachOf(...).when(...).detect() - list detector', () => {
        it('exposes per-index watched values and aggregate counts', () => {
            const items = [{ hp: 10 }, { hp: 10 }];
            const w = Watch().eachOf(() => items).when((i) => i.hp).detect();

            expect(w.poll().changedCount).toBe(2); // first poll
            items[1].hp = 7;
            const r = w.poll();

            expect(r.count).toBe(2);
            expect(r.changedCount).toBe(1);
            expect(r.anyChanged).toBe(true);
            expect(r.at(0).changed).toBe(false);
            expect(r.at(1).changed).toBe(true);
            expect(r.at(1).value).toBe(7);
            expect(r.at(1).previous).toBe(10);
            expect(r.at(1).item).toBe(items[1]);
        });
    });
});
