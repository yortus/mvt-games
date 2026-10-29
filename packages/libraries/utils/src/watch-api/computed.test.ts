import { describe, expect, expectTypeOf, it } from 'vitest';
import { createComputed, type Computed } from './computed';

describe('createComputed', () => {
    it('computes on its first read, then only when something it watches changes', () => {
        let score = 10;
        let computes = 0;
        const scoreText = createComputed({
            watch: () => score,
            compute: (s) => {
                computes++;
                return `SCORE ${s}`;
            },
        });
        expect(computes).toBe(0);
        expect(scoreText()).toBe('SCORE 10');
        expect(scoreText()).toBe('SCORE 10');
        expect(computes).toBe(1);
        score = 20;
        expect(scoreText()).toBe('SCORE 20');
        expect(computes).toBe(2);
    });

    it("is lazy: it doesn't read its getters until its first read", () => {
        const model: { score?: number } = {};
        const scoreText = createComputed({ watch: () => model.score!, compute: (s) => `SCORE ${s}` });
        model.score = 5;
        expect(scoreText()).toBe('SCORE 5');
    });

    it('recomputes when any value of a record changes, and passes the values by name', () => {
        const cols = 2;
        let rows = 2;
        const grid = createComputed({
            watch: { cols: () => cols, rows: () => rows },
            compute: ({ cols, rows }) => `${cols}x${rows}`,
        });
        expect(grid()).toBe('2x2');
        rows = 3;
        expect(grid()).toBe('2x3');
    });

    it('may read state it does not watch, when something it watches changes with it', () => {
        const entities = ['ant', 'bee'];
        let version = 0;
        const summary = createComputed({ watch: () => version, compute: () => entities.join(',') });
        expect(summary()).toBe('ant,bee');
        entities[1] = 'cat';
        version++;
        expect(summary()).toBe('ant,cat');
    });

    it('maintains an object made by a default parameter, updated in place', () => {
        let size = 2;
        let creates = 0;
        const makeCells = (): number[] => {
            creates++;
            return [];
        };
        const cells = createComputed({
            watch: () => size,
            compute: (n, array = makeCells()) => {
                while (array.length < n) array.push(0);
                array.length = n;
                return array;
            },
        });
        const first = cells();
        size = 4;
        const second = cells();
        expect(second).toBe(first);
        expect(second.length).toBe(4);
        expect(creates).toBe(1);
    });

    it("raises an object's version on every recompute, and reading the version brings it up to date", () => {
        let size = 1;
        const cells = createComputed({
            watch: () => size,
            compute: (n, array: number[] = []) => {
                array.length = n;
                return array;
            },
        });
        const firstVersion = cells.version;
        expect(firstVersion).toBe(1);
        size = 3;
        expect(cells.version).toBe(firstVersion + 1);
        expect(cells.version).toBe(firstVersion + 1);
        expect(cells().length).toBe(3);
    });

    it("raises a primitive's version only when the value changes", () => {
        let score = 1200;
        const level = createComputed({ watch: () => score, compute: (s) => Math.floor(s / 1000) });
        const before = level.version;
        score = 1500;
        expect(level.version).toBe(before);
        score = 2100;
        expect(level.version).toBe(before + 1);
    });

    it('chains: a computed primitive is a getter another can watch', () => {
        let score = 0;
        const level = createComputed({ watch: () => score, compute: (s) => Math.floor(s / 100) });
        const label = createComputed({ watch: level, compute: (l) => `LEVEL ${l}` });
        expect(label()).toBe('LEVEL 0');
        score = 250;
        expect(label()).toBe('LEVEL 2');
    });

    it('builds on a computed object by its version, reading the object inside compute', () => {
        let size = 2;
        const cells = createComputed({
            watch: () => size,
            compute: (n, array: number[] = []) => {
                array.length = n;
                return array;
            },
        });
        const count = createComputed({ watch: () => cells.version, compute: () => cells().length });
        expect(count()).toBe(2);
        size = 5;
        expect(count()).toBe(5);
    });

    it('computes again on the next read after compute threw', () => {
        let shouldThrow = true;
        const value = createComputed({
            watch: () => 1,
            compute: () => {
                if (shouldThrow) throw new Error('not yet');
                return 'ready';
            },
        });
        expect(() => value()).toThrow('not yet');
        shouldThrow = false;
        expect(value()).toBe('ready');
    });

    it('throws if it reads itself while computing', () => {
        const looped: { value?: () => number } = {};
        const self = createComputed({ watch: () => 1, compute: () => (looped.value?.() ?? 0) + 1 });
        looped.value = self;
        expect(() => self()).toThrow(/read itself/);
    });

    it('throws if a getter reads the computed value itself', () => {
        const looped: { value?: () => number } = {};
        const self = createComputed({ watch: () => looped.value?.() ?? 0, compute: (n) => n + 1 });
        looped.value = self;
        expect(() => self()).toThrow(/read itself/);
    });

    it('throws on an array, saying to use a record', () => {
        // @ts-expect-error: a computed value takes a record, not an array.
        const makePair = (): unknown => createComputed({ watch: [() => 1, () => 2], compute: () => 0 });
        expect(makePair).toThrow(/Name the values in a record/);
    });

    it('throws on an empty record when it is made', () => {
        // @ts-expect-error: an empty record never changes.
        expect(() => createComputed({ watch: {}, compute: () => 0 })).toThrow(/empty record/);
    });

    it("lets a record use any name, since only a watcher's reading uses anyChanged", () => {
        const value = createComputed({ watch: { anyChanged: () => 2 }, compute: (v) => v.anyChanged * 2 });
        expect(value()).toBe(4);
    });

    describe('types', () => {
        it('infers the value from compute, and refuses mistakes', () => {
            // Declarations for the type checker only: this function is never called.
            const declareTests = (fixtures: Fixtures): void => {
                const { bindings } = fixtures;

                const scoreText = createComputed({ watch: bindings.score, compute: (score) => `SCORE ${score}` });
                expectTypeOf(scoreText).toEqualTypeOf<Computed<string>>();
                expectTypeOf(scoreText()).toEqualTypeOf<string>();
                expectTypeOf(scoreText.version).toEqualTypeOf<number>();
                const grid = createComputed({
                    watch: { cols: bindings.cols, rows: bindings.rows },
                    compute: ({ cols, rows }) => buildGrid(cols, rows),
                });
                expectTypeOf(grid).toEqualTypeOf<Computed<Grid>>();
                const isInDanger = createComputed({
                    watch: { isActive: bindings.isActive, phase: bindings.phase },
                    compute: (values) => {
                        expectTypeOf(values.isActive).toEqualTypeOf<boolean>();
                        expectTypeOf(values.phase).toEqualTypeOf<GamePhase>();
                        return values.isActive && values.phase === 'playing';
                    },
                });
                expectTypeOf(isInDanger).toEqualTypeOf<Computed<boolean>>();
                // A computed primitive is a getter, and a computed object is watched by its version
                const label = createComputed({ watch: scoreText, compute: (text) => text.toLowerCase() });
                expectTypeOf(label).toEqualTypeOf<Computed<string>>();
                const width = createComputed({ watch: () => grid.version, compute: () => grid().length });
                expectTypeOf(width).toEqualTypeOf<Computed<number>>();

                // Maintaining an object: the second parameter takes its type from its default
                const cells = createComputed({
                    watch: bindings.cols,
                    compute: (size, cells = createCells()) => {
                        expectTypeOf(cells).toEqualTypeOf<Cells>();
                        return resize(cells, size);
                    },
                });
                expectTypeOf(cells).toEqualTypeOf<Computed<Cells>>();
                const typedReturn = createComputed({
                    watch: bindings.cols,
                    compute: (size, cells = createCells()): Cells => resize(cells, size),
                });
                expectTypeOf(typedReturn).toEqualTypeOf<Computed<Cells>>();

                // Mistakes
                // @ts-expect-error: `last` needs a default, so the object always exists.
                createComputed({ watch: bindings.cols, compute: (size, cells: Cells) => resize(cells, size) });
                // @ts-expect-error: a computed value has no condition.
                createComputed({ watch: bindings.score, when: 1, compute: (score) => score });
                // @ts-expect-error: an array is refused: name the values in a record.
                createComputed({ watch: [bindings.cols, bindings.rows], compute: () => 0 });
                // @ts-expect-error: an empty record never changes.
                createComputed({ watch: {}, compute: () => 0 });
                // @ts-expect-error: a getter of an object isn't watchable.
                createComputed({ watch: () => grid(), compute: () => 0 });
                // @ts-expect-error: nor is a computed object: watch its version.
                createComputed({ watch: grid, compute: () => 0 });
            };
            expect(declareTests).toBeTypeOf('function');
        });
    });
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type GamePhase = 'playing' | 'dying' | 'game-over';
type Grid = readonly (readonly number[])[];
interface Cells {
    readonly values: number[];
}

interface Fixtures {
    readonly bindings: {
        readonly score: () => number;
        readonly cols: () => number;
        readonly rows: () => number;
        readonly isActive: () => boolean;
        readonly phase: () => GamePhase;
    };
}

declare function buildGrid(cols: number, rows: number): Grid;
declare function createCells(): Cells;
declare function resize(cells: Cells, size: number): Cells;
