import { describe, expect, it } from 'vitest';
import { createForestModel, type ForestModel } from './forest-model';

describe('the fractal forest', () => {
    it('grows every tree through spring', () => {
        const model = createForestModel();
        expect(model.season).toBe('spring');
        runUntil(model, () => model.season === 'summer');
        for (const tree of model.trees) {
            expect(tree.branches.length).toBeGreaterThan(0);
            expect(tree.branches.every((b) => b.growth === 1)).toBe(true);
        }
    });

    it('splits every branch in two, so a tree has one branch fewer than a power of two', () => {
        const model = createForestModel();
        for (const tree of model.trees) expect(Number.isInteger(Math.log2(tree.branches.length + 1))).toBe(true);
    });

    it('has the trees at the back no bigger than those at the front', () => {
        const model = createForestModel();
        const back = model.trees[0];
        const front = model.trees[model.trees.length - 1];
        expect(back.distance).toBeGreaterThan(front.distance);
        expect(back.leaves.length).toBeLessThan(front.leaves.length);
    });

    it('has every leaf open and green by midsummer', () => {
        const model = createForestModel();
        // The last leaves of spring are still opening as summer begins
        runUntil(model, () => model.yearProgress >= 0.375);
        for (const tree of model.trees) {
            for (const leaf of tree.leaves) {
                expect(leaf.size).toBe(1);
                expect(leaf.turn).toBe(0);
                expect(leaf.isAttached).toBe(true);
            }
        }
    });

    it('turns and drops every leaf by early winter, onto the ground', () => {
        const model = createForestModel();
        // The last leaves of autumn are still falling as winter begins
        runUntil(model, () => model.yearProgress >= 0.85);
        for (const tree of model.trees) {
            for (const leaf of tree.leaves) {
                expect(leaf.turn).toBe(1);
                expect(leaf.isAttached).toBe(false);
                expect(leaf.y).toBeLessThanOrEqual(0);
            }
        }
    });

    it('keeps every branch above the ground, however hard a tree curls', () => {
        for (let forest = 0; forest < 50; forest++) {
            for (const tree of createForestModel().trees) {
                for (const branch of tree.branches) expect(branch.y1).toBeGreaterThan(0);
            }
        }
    });

    it('lets each leaf go from where it was, without a jump', () => {
        const model = createForestModel();
        runUntil(model, () => model.season === 'autumn');
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
        const model = createForestModel();
        runUntil(model, () => model.season === 'winter');
        const oldTips = model.trees.map((tree) => tree.branches.map((b) => b.x1).join()).join();
        runUntil(model, () => model.season === 'spring');
        expect(model.trees.map((tree) => tree.branches.map((b) => b.x1).join()).join()).not.toBe(oldTips);
    });
});

/** Advances the model a frame at a time until `isDone`, failing after two minutes of its time. */
function runUntil(model: ForestModel, isDone: () => boolean): void {
    for (let ms = 0; ms < 120_000; ms += 16) {
        model.update(16);
        if (isDone()) return;
    }
    throw new Error('Gave up after two minutes.');
}
