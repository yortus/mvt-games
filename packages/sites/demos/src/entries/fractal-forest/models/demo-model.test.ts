import { describe, expect, it } from 'vitest';
import { createRandom } from '@mvtjs/site-kit/random';
import { createDemoModel, type DemoModel } from './demo-model';

describe('the fractal forest', () => {
    it('grows every tree through spring', () => {
        expect(createForest().season).toBe('spring');
        const model = createForest(SUMMER);
        expect(model.season).toBe('summer');
        for (const tree of model.trees) {
            expect(tree.branches.length).toBeGreaterThan(0);
            expect(tree.branches.every((b) => b.growth === 1)).toBe(true);
        }
    });

    it('splits every branch in two, so a tree has one branch fewer than a power of two', () => {
        const model = createForest();
        for (const tree of model.trees) expect(Number.isInteger(Math.log2(tree.branches.length + 1))).toBe(true);
    });

    it('has the trees at the back no bigger than those at the front', () => {
        const model = createForest();
        const back = model.trees[0];
        const front = model.trees[model.trees.length - 1];
        expect(back.distance).toBeGreaterThan(front.distance);
        expect(back.leaves.length).toBeLessThan(front.leaves.length);
    });

    it('has every leaf open and green by midsummer', () => {
        // The last leaves of spring are still opening as summer begins
        const model = createForest(0.375);
        for (const tree of model.trees) {
            for (const leaf of tree.leaves) {
                expect(leaf.size).toBe(1);
                expect(leaf.turn).toBe(0);
                expect(leaf.isAttached).toBe(true);
            }
        }
    });

    it('turns and drops every leaf by early winter, onto the ground', () => {
        // The last leaves of autumn are still falling as winter begins
        const model = createForest(0.85);
        for (const tree of model.trees) {
            for (const leaf of tree.leaves) {
                expect(leaf.turn).toBe(1);
                expect(leaf.isAttached).toBe(false);
                expect(leaf.y).toBeLessThanOrEqual(0);
            }
        }
    });

    it('keeps every branch above the ground, however hard a tree curls', () => {
        let lowest = Infinity;
        for (let seed = 0; seed < 50; seed++) {
            for (const tree of createDemoModel({ random: createRandom({ seed }) }).trees) {
                for (const branch of tree.branches) lowest = Math.min(lowest, branch.y1);
            }
        }
        expect(lowest).toBeGreaterThan(0);
    });

    it('lets each leaf go from where it was, without a jump', () => {
        const model = createForest(AUTUMN);
        const leaves = model.trees.flatMap((tree) => tree.leaves);
        let letGo = 0;
        while (model.season === 'autumn') {
            const before = leaves.map((leaf) => ({ x: leaf.x, y: leaf.y, isAttached: leaf.isAttached }));
            model.update(16);
            for (let i = 0; i < leaves.length; i++) {
                if (!before[i].isAttached || leaves[i].isAttached) continue;
                letGo++;
                // No further than a falling leaf goes in one frame
                expect(Math.hypot(leaves[i].x - before[i].x, leaves[i].y - before[i].y)).toBeLessThan(0.05);
            }
        }
        expect(letGo).toBe(leaves.length);
    });

    it('grows new trees each spring', () => {
        // The last moment of winter, so one frame crosses into spring
        const model = createForest(0.9999);
        const oldTips = listTips(model);
        model.update(16);
        expect(model.season).toBe('spring');
        expect(listTips(model)).not.toBe(oldTips);
    });
});

/** Where summer and autumn begin, as shares of the year. */
const SUMMER = 0.25;
const AUTUMN = 0.5;

/** A forest from one seed, so every run sees the same trees, at `yearProgress` through its first year. */
function createForest(yearProgress = 0): DemoModel {
    return createDemoModel({ random: createRandom({ seed: 1 }), yearProgress });
}

/** Where every branch ends, as one string, to tell one year's trees from the next. */
function listTips(model: DemoModel): string {
    return model.trees.map((tree) => tree.branches.map((b) => b.x1).join()).join();
}
