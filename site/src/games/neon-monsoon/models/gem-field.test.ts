import { describe, expect, it } from 'vitest';
import { createGemField } from './gem-field';

function setUp() {
    const target = { x: 100, y: 300, isAlive: true };
    const gems = createGemField({ capacity: 4, target, margin: 16 });
    return { target, gems };
}

describe('GemField', () => {
    it('floats new gems up before they home in on the target', () => {
        const { gems } = setUp();
        gems.spawn(100, 100);
        gems.update(100);
        expect(gems.yOf(0)).toBeLessThan(100);
    });

    it('then flies them to the target, where they are collected', () => {
        const { gems } = setUp();
        gems.spawn(100, 100);
        for (let i = 0; i < 120; i++) gems.update(1000 / 60);
        expect(gems.yOf(0)).toBeCloseTo(300);
        expect(gems.collectTouching(100, 300, 12)).toBe(1);
        expect(gems.count).toBe(0);
    });

    it('drifts gems away while the target is not alive', () => {
        const { target, gems } = setUp();
        target.isAlive = false;
        gems.spawn(100, 0);
        for (let i = 0; i < 60; i++) gems.update(1000 / 60);
        expect(gems.count).toBe(0);
    });

    it('drops gems beyond its capacity', () => {
        const { gems } = setUp();
        for (let i = 0; i < 4; i++) gems.spawn(0, 0);
        expect(gems.spawn(0, 0)).toBe(false);
        expect(gems.count).toBe(4);
    });
});
