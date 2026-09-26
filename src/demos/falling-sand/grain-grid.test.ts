import { describe, expect, it } from 'vitest';
import { createGrainGrid, type GrainGrid } from './grain-grid';
import { createRandom } from './random';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(cols = 5, rows = 5): GrainGrid {
    return createGrainGrid({ cols, rows, random: createRandom(7) });
}

function stepTimes(grid: GrainGrid, count: number): void {
    for (let i = 0; i < count; i++) grid.step();
}

function countKind(grid: GrainGrid, kind: string): number {
    let count = 0;
    for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
            if (grid.kindAt(col, row) === kind) count++;
        }
    }
    return count;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('grain grid', () => {
    describe('adding and removing', () => {
        it('puts a grain in an empty cell and refuses a taken or outside one', () => {
            const grid = setup();

            expect(grid.add(2, 1, 'sand')).toBe(true);
            expect(grid.add(2, 1, 'water')).toBe(false);
            expect(grid.add(-1, 0, 'sand')).toBe(false);
            expect(grid.add(0, 5, 'sand')).toBe(false);

            expect(grid.kindAt(2, 1)).toBe('sand');
            expect(grid.grainCount).toBe(1);
        });

        it('exposes grains by id, with a removed id reading as undefined', () => {
            const grid = setup();
            grid.add(0, 0, 'wall');
            grid.add(1, 0, 'wall');

            expect(grid.grains.length).toBe(2);
            expect(grid.grains.at(1)?.col).toBe(1);

            grid.remove(0, 0);
            expect(grid.grains.at(0)).toBeUndefined();
            expect(grid.grains.at(1)?.col).toBe(1);
            expect(grid.grainCount).toBe(1);
        });

        it('reuses the lowest free id, and trims the length when the highest ids free up', () => {
            const grid = setup();
            grid.add(0, 0, 'wall');
            grid.add(1, 0, 'wall');
            grid.add(2, 0, 'wall');

            grid.remove(0, 0);
            grid.add(3, 0, 'wall');
            expect(grid.grains.at(0)?.col).toBe(3);

            grid.remove(2, 0);
            expect(grid.grains.length).toBe(2);
        });

        it('keeps a grain\'s id while it moves', () => {
            const grid = setup();
            grid.add(2, 0, 'sand');
            const grain = grid.grains.at(0);

            stepTimes(grid, 10);

            expect(grain?.row).toBe(4);
            expect(grid.grains.at(0)).toBe(grain);
        });
    });

    describe('sand', () => {
        it('falls to the floor, speeding up as it goes', () => {
            const grid = createGrainGrid({ cols: 1, rows: 40, random: createRandom(1) });
            grid.add(0, 0, 'sand');
            const grain = grid.grains.at(0)!;

            const rowsPerStep: number[] = [];
            let lastRow = 0;
            for (let i = 0; i < 8; i++) {
                grid.step();
                rowsPerStep.push(grain.row - lastRow);
                lastRow = grain.row;
            }

            expect(rowsPerStep[0]).toBe(1);
            expect(rowsPerStep[7]).toBeGreaterThan(1);

            stepTimes(grid, 40);
            expect(grain.row).toBe(39);
        });

        it('never passes through a grain in its way, however fast it falls', () => {
            const grid = createGrainGrid({ cols: 1, rows: 40, random: createRandom(1) });
            grid.add(0, 30, 'wall');
            grid.add(0, 0, 'sand');

            stepTimes(grid, 40);

            expect(grid.kindAt(0, 29)).toBe('sand');
        });

        it('poured onto one point, slides off itself into a heap', () => {
            const grid = setup(9, 6);
            for (let i = 0; i < 9; i++) {
                grid.add(4, 0, 'sand');
                stepTimes(grid, 10);
            }

            // Nine grains cannot stack in one column six deep; they spread both
            // ways, and nothing is left overhanging an empty cell.
            expect(grid.kindAt(4, 5)).toBe('sand');
            expect(grid.kindAt(3, 5)).toBe('sand');
            expect(grid.kindAt(5, 5)).toBe('sand');
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 9; col++) {
                    if (grid.kindAt(col, row) === 'sand') expect(grid.kindAt(col, row + 1)).toBe('sand');
                }
            }
            expect(grid.movingCount).toBe(0);
        });

        it('sinks through water', () => {
            const grid = setup(1, 4);
            grid.add(0, 3, 'water');
            grid.add(0, 2, 'water');
            grid.add(0, 1, 'sand');

            stepTimes(grid, 60);

            expect(grid.kindAt(0, 3)).toBe('sand');
            expect(countKind(grid, 'water')).toBe(2);
        });
    });

    describe('water', () => {
        it('spreads out to find its level', () => {
            const grid = setup(6, 3);
            for (let row = 0; row < 3; row++) {
                grid.add(0, row, 'water');
                grid.add(1, row, 'water');
            }

            stepTimes(grid, 100);

            // Six grains on a floor six cells wide: one flat layer.
            for (let col = 0; col < 6; col++) expect(grid.kindAt(col, 2)).toBe('water');
            expect(countKind(grid, 'water')).toBe(6);
        });
    });

    describe('water at rest', () => {
        it('a lone drop on a flat floor comes to rest', () => {
            const grid = setup(20, 3);
            grid.add(10, 0, 'water');

            stepTimes(grid, 20);

            expect(grid.movingCount).toBe(0);
        });

        it('a thin layer on a flat floor comes to rest', () => {
            const grid = setup(30, 4);
            for (let col = 5; col < 15; col += 2) grid.add(col, 3, 'water');

            stepTimes(grid, 20);

            expect(grid.movingCount).toBe(0);
        });

        it('a pool in a basin settles, level to within one cell', () => {
            const grid = setup(24, 16);
            // A basin with walls and a floor, filled from above.
            for (let row = 4; row < 16; row++) {
                grid.add(2, row, 'wall');
                grid.add(21, row, 'wall');
            }
            for (let col = 2; col < 22; col++) grid.add(col, 15, 'wall');
            for (let i = 0; i < 90; i++) grid.add(4 + (i % 8), Math.floor(i / 8), 'water');

            stepTimes(grid, 400);

            expect(grid.movingCount).toBe(0);
            let highest = grid.rows;
            let lowestEmpty = 0;
            for (let col = 3; col < 21; col++) {
                for (let row = 0; row < 15; row++) {
                    if (grid.kindAt(col, row) === 'water') {
                        highest = Math.min(highest, row);
                    }
                    else {
                        lowestEmpty = Math.max(lowestEmpty, row);
                    }
                }
            }
            expect(lowestEmpty - highest).toBeLessThanOrEqual(1);
        });
    });

    describe('walls', () => {
        it('never move and are never visited by a step', () => {
            const grid = setup();
            grid.add(2, 0, 'wall');

            stepTimes(grid, 5);

            expect(grid.kindAt(2, 0)).toBe('wall');
            expect(grid.movingCount).toBe(0);
        });
    });

    describe('sleeping and waking', () => {
        it('puts a grain to sleep once it has settled', () => {
            const grid = setup();
            grid.add(2, 0, 'sand');
            expect(grid.movingCount).toBe(1);

            stepTimes(grid, 20);

            expect(grid.kindAt(2, 4)).toBe('sand');
            expect(grid.movingCount).toBe(0);
        });

        it('wakes a settled grain when the cell below it empties', () => {
            const grid = setup(1, 5);
            grid.add(0, 4, 'wall');
            grid.add(0, 3, 'sand');
            stepTimes(grid, 5);
            expect(grid.movingCount).toBe(0);

            grid.remove(0, 4);
            expect(grid.movingCount).toBe(1);

            grid.step();
            expect(grid.kindAt(0, 4)).toBe('sand');
        });

        it('keeps a settled pile asleep while grains fall elsewhere', () => {
            const grid = setup(9, 9);
            for (let col = 0; col < 4; col++) grid.add(col, 8, 'sand');
            stepTimes(grid, 5);
            expect(grid.movingCount).toBe(0);

            grid.add(8, 0, 'sand');
            grid.step();

            expect(grid.movingCount).toBe(1);
        });
    });

    describe('rotating a half turn', () => {
        it('moves every grain to the opposite cell and wakes all but walls', () => {
            const grid = setup(4, 3);
            grid.add(0, 2, 'sand');
            grid.add(3, 2, 'wall');
            stepTimes(grid, 5);
            expect(grid.movingCount).toBe(0);

            grid.rotateHalfTurn();

            expect(grid.kindAt(3, 0)).toBe('sand');
            expect(grid.kindAt(0, 0)).toBe('wall');
            expect(grid.movingCount).toBe(1);
        });
    });

    describe('determinism', () => {
        it('replays exactly from the same seed', () => {
            const run = (): string => {
                const grid = createGrainGrid({ cols: 12, rows: 12, random: createRandom(3) });
                for (let col = 3; col < 9; col++) {
                    grid.add(col, 0, 'sand');
                    grid.add(col, 1, 'water');
                }
                stepTimes(grid, 50);
                let snapshot = '';
                for (let row = 0; row < 12; row++) {
                    for (let col = 0; col < 12; col++) snapshot += grid.kindAt(col, row)?.[0] ?? '.';
                }
                return snapshot;
            };

            expect(run()).toBe(run());
        });
    });
});
