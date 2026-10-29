import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createComputed, type Computed } from './computed';
import { watch } from './watch';
import type { Watched, WatchedNumber } from './watched';

describe('watch', () => {
    it('reads its getters when made, so the first poll reports only what changed since', () => {
        let score = 10;
        const watcher = watch(() => score);
        const first = watcher.poll();
        expect(first.changed).toBe(false);
        expect(first.current).toBe(10);
        expect(first.previous).toBe(10);
        expect(first.increased).toBe(false);

        score = 20;
        const second = watcher.poll();
        expect(second.changed).toBe(true);
        expect(second.current).toBe(20);
        expect(second.previous).toBe(10);
        expect(second.increased).toBe(true);
        expect(second.decreased).toBe(false);
    });

    it('sees a change made between construction and the first poll', () => {
        let beats = 0;
        const watcher = watch(() => beats);
        beats = 1;
        expect(watcher.poll().increased).toBe(true);
    });

    it('sets previous to current when nothing changed', () => {
        let lives = 3;
        const watcher = watch(() => lives);
        lives = 2;
        watcher.poll();
        const w = watcher.poll();
        expect(w.changed).toBe(false);
        expect(w.previous).toBe(2);
        expect(w.decreased).toBe(false);
    });

    it('says what a value changed to and from', () => {
        let phase = 'playing';
        const watcher = watch(() => phase);
        phase = 'dying';
        const w = watcher.poll();
        expect(w.changedTo('dying')).toBe(true);
        expect(w.changedTo('playing')).toBe(false);
        expect(w.changedFrom('playing')).toBe(true);
        // Nothing changed on the next poll, so nothing changed to anything
        expect(watcher.poll().changedTo('dying')).toBe(false);
    });

    it('watches a record by name, and says whether anything changed', () => {
        const cols = 4;
        let rows = 3;
        const watcher = watch({ cols: () => cols, rows: () => rows });
        expect(watcher.poll().anyChanged).toBe(false);
        rows = 5;
        const w = watcher.poll();
        expect(w.anyChanged).toBe(true);
        expect(w.cols.changed).toBe(false);
        expect(w.rows.changed).toBe(true);
        expect(w.rows.current).toBe(5);
    });

    it('watches an array by position', () => {
        const count = 1;
        let label = 'x';
        const watcher = watch([() => count, () => label]);
        label = 'y';
        const w = watcher.poll();
        expect(w.anyChanged).toBe(true);
        expect(w.length).toBe(2);
        expect(w[0].changed).toBe(false);
        expect(w[1].changedTo('y')).toBe(true);
    });

    it('watches nothing, for good, given an array that is empty at run time', () => {
        const getters: (() => number)[] = [];
        const watcher = watch(getters);
        getters.push(() => 1);
        const w = watcher.poll();
        expect(w.anyChanged).toBe(false);
        expect(w.length).toBe(0);
    });

    it('compares with ===, so a watched NaN is a change on every poll', () => {
        const watcher = watch(() => Number.NaN);
        expect(watcher.poll().changed).toBe(true);
        expect(watcher.poll().changed).toBe(true);
    });

    it('watches bigints, symbols, null and undefined', () => {
        const up = Symbol('up');
        // eslint-disable-next-line @mvtjs/no-null -- a watched value may be `null`, from an outside API
        let values: [bigint, symbol | undefined, string | null] = [1n, undefined, null];
        const watcher = watch([() => values[0], () => values[1], () => values[2]]);
        values = [3n, up, 'set'];
        const w = watcher.poll();
        expect(w[0].increased).toBe(true);
        expect(w[1].changedTo(up)).toBe(true);
        // eslint-disable-next-line @mvtjs/no-null -- a watched value may be `null`, from an outside API
        expect(w[2].changedFrom(null)).toBe(true);
    });

    it('watches a computed primitive by its value, and a computed object by its version', () => {
        let cols = 2;
        const label = createComputed({ watch: () => cols, compute: (n) => `${n} columns` });
        const cells = createComputed({
            watch: () => cols,
            compute: (n, array: number[] = []) => {
                array.length = n;
                return array;
            },
        });
        const watcher = watch({ label, cellsVersion: () => cells.version });
        cols = 3;
        const w = watcher.poll();
        expect(w.label.changedTo('3 columns')).toBe(true);
        expect(w.cellsVersion.increased).toBe(true);
    });

    it('throws on a getter that returns an object, naming it', () => {
        // @ts-expect-error: an array can't be watched.
        expect(() => watch({ cells: () => [1, 2, 3] })).toThrow(/watch\.cells gave an array, which can't be watched/);
    });

    it('throws when a getter starts returning an object', () => {
        let value: unknown = 1;
        const watcher = watch(() => value as number);
        value = () => 1;
        expect(() => watcher.poll()).toThrow(/watch gave a function/);
    });

    it('throws on an empty record, and on a getter called anyChanged', () => {
        // @ts-expect-error: an empty record never changes.
        expect(() => watch({})).toThrow(/empty record/);
        // @ts-expect-error: the reading uses that name.
        expect(() => watch({ anyChanged: () => 1 })).toThrow(/called anyChanged/);
    });

    it('throws on something that is not a getter', () => {
        // @ts-expect-error: every value in a record must be a getter.
        expect(() => watch({ score: 1 })).toThrow(/watch\.score must be a getter/);
        // @ts-expect-error: a number isn't a getter.
        expect(() => watch(1)).toThrow(/watch takes a getter/);
    });

    describe('in development', () => {
        it.runIf(import.meta.env.DEV)('throws when a reading is used after the next poll', () => {
            let phase = 'a';
            const watcher = watch({ phase: () => phase });
            const kept = watcher.poll();
            const keptPhase = kept.phase;
            phase = 'b';
            const fresh = watcher.poll();
            expect(fresh.phase.changedTo('b')).toBe(true);
            expect(() => kept.anyChanged).toThrow(/kept past the next poll/);
            expect(() => keptPhase.current).toThrow(/kept past the next poll/);
            expect(() => 'phase' in kept).toThrow(/kept past the next poll/);
            expect(() => Object.keys(kept)).toThrow(/kept past the next poll/);
        });

        it.runIf(import.meta.env.DEV)("throws when one getter's reading is used after the next poll", () => {
            const watcher = watch(() => 1);
            const kept = watcher.poll();
            watcher.poll();
            expect(() => kept.changed).toThrow(/kept past the next poll/);
        });

        it.runIf(import.meta.env.DEV)("throws when an array's reading is used after the next poll", () => {
            const watcher = watch([() => 1, () => 2]);
            const kept = watcher.poll();
            const first = kept[0];
            watcher.poll();
            expect(() => kept[1]).toThrow(/kept past the next poll/);
            expect(() => first.current).toThrow(/kept past the next poll/);
        });

        it.runIf(import.meta.env.DEV)('refuses changes to a reading', () => {
            const watcher = watch({ score: () => 1 });
            const w = watcher.poll() as { anyChanged: boolean };
            expect(() => {
                w.anyChanged = true;
            }).toThrow(/can't be changed/);
        });

        it('leaves values copied out of a reading safe to keep', () => {
            let score = 1;
            const watcher = watch({ score: () => score });
            score = 2;
            const { current, changed } = watcher.poll().score;
            watcher.poll();
            expect(current).toBe(2);
            expect(changed).toBe(true);
        });
    });

    describe('in production', () => {
        afterEach(() => {
            vi.unstubAllEnvs();
            vi.resetModules();
        });

        it('returns the reading itself on every poll, so polling allocates nothing', async () => {
            vi.stubEnv('DEV', false);
            vi.resetModules();
            const { watch: watchInProduction } = await import('./watch');
            let score = 1;
            const watcher = watchInProduction({ score: () => score });
            const first = watcher.poll();
            score = 2;
            const second = watcher.poll();
            expect(second).toBe(first);
            expect(second.score.changed).toBe(true);
        });
    });

    describe('types', () => {
        it('infers a reading for each shape, and refuses mistakes', () => {
            // Declarations for the type checker only: this function is never called.
            /* eslint-disable @mvtjs/no-unused-watch, @mvtjs/no-inline-watch -- declarations only, never run */
            const declareTests = (fixtures: Fixtures): void => {
                const { bindings, scoreText, cells, reels } = fixtures;

                const record = watch({ phase: bindings.phase, lives: bindings.lives }).poll();
                expectTypeOf(record.phase).toEqualTypeOf<Watched<GamePhase>>();
                expectTypeOf(record.lives).toEqualTypeOf<WatchedNumber<number>>();
                expectTypeOf(record.anyChanged).toEqualTypeOf<boolean>();

                // One getter's reading is its Watched, with no anyChanged, since `changed` says it
                const single = watch(bindings.phase).poll();
                expectTypeOf(single).toEqualTypeOf<Watched<GamePhase>>();
                expectTypeOf(watch(bindings.big).poll()).toEqualTypeOf<WatchedNumber<bigint>>();

                // A literal array is typed by position, and an array from map has one type
                const tuple = watch([bindings.phase, bindings.lives, bindings.big]).poll();
                expectTypeOf(tuple[0]).toEqualTypeOf<Watched<GamePhase>>();
                expectTypeOf(tuple[1]).toEqualTypeOf<WatchedNumber<number>>();
                expectTypeOf(tuple[2]).toEqualTypeOf<WatchedNumber<bigint>>();
                expectTypeOf(tuple.anyChanged).toEqualTypeOf<boolean>();
                const mapped = watch(reels.map((reel) => () => reel.phase)).poll();
                expectTypeOf(mapped[0]).toEqualTypeOf<Watched<ReelPhase>>();
                expectTypeOf(mapped.anyChanged).toEqualTypeOf<boolean>();

                // A computed primitive is a getter
                expectTypeOf(watch(scoreText).poll()).toEqualTypeOf<Watched<string>>();
                expectTypeOf(watch(() => cells.version).poll()).toEqualTypeOf<WatchedNumber<number>>();

                // Only an exactly numeric type gets increased and decreased
                const maybe = watch(bindings.maybeLevel).poll();
                expectTypeOf(maybe).toEqualTypeOf<Watched<number | undefined>>();

                // Mistakes
                // @ts-expect-error: a string has no increased.
                void single.increased;
                // @ts-expect-error: one getter's reading has no anyChanged.
                void single.anyChanged;
                // @ts-expect-error: an empty array never changes.
                watch([]);
                // @ts-expect-error: an empty record never changes.
                watch({});
                // @ts-expect-error: the reading uses the name anyChanged.
                watch({ anyChanged: bindings.lives });
                // @ts-expect-error: a getter of an object isn't watchable.
                watch(() => reels);
                // @ts-expect-error: nor is one in a record.
                watch({ reels: () => reels });
                // @ts-expect-error: a computed object isn't watchable: watch its version.
                watch(cells);
            };
            /* eslint-enable @mvtjs/no-unused-watch, @mvtjs/no-inline-watch */
            expect(declareTests).toBeTypeOf('function');
        });
    });
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type GamePhase = 'playing' | 'dying' | 'game-over';
type ReelPhase = 'stopped' | 'spinning' | 'settling';

interface Fixtures {
    readonly bindings: {
        readonly phase: () => GamePhase;
        readonly lives: () => number;
        readonly big: () => bigint;
        readonly maybeLevel: () => number | undefined;
    };
    readonly scoreText: Computed<string>;
    readonly cells: Computed<number[]>;
    readonly reels: readonly { readonly phase: ReelPhase }[];
}
