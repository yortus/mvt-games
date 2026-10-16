import { describe, expect, it } from 'vitest';
import type { StageEvent } from '../data';
import { createStageModel } from './stage-model';

const EVENTS: readonly StageEvent[] = [
    { kind: 'warning', atMs: 100 },
    { kind: 'warning', atMs: 100 },
    { kind: 'boss', atMs: 300 },
];

describe('StageModel', () => {
    it('hands out each event once its time has come, in order', () => {
        const stage = createStageModel({ events: EVENTS, scrollSpeed: 10 });
        expect(stage.consumeNextDueEvent()).toBeUndefined();
        stage.update(100);
        expect(stage.consumeNextDueEvent()).toBe(EVENTS[0]);
        expect(stage.consumeNextDueEvent()).toBe(EVENTS[1]);
        expect(stage.consumeNextDueEvent()).toBeUndefined();
    });

    it('scrolls until it hands out the boss', () => {
        const stage = createStageModel({ events: EVENTS, scrollSpeed: 10 });
        stage.update(300);
        expect(stage.scrollY).toBeCloseTo(3);
        while (stage.consumeNextDueEvent() !== undefined) { /* take all */ }
        expect(stage.scrollSpeed).toBe(0);
        stage.update(1000);
        expect(stage.scrollY).toBeCloseTo(3);
    });

    it('restarts from the top', () => {
        const stage = createStageModel({ events: EVENTS, scrollSpeed: 10 });
        stage.update(500);
        while (stage.consumeNextDueEvent() !== undefined) { /* take all */ }
        stage.restart();
        expect(stage.timeMs).toBe(0);
        expect(stage.scrollY).toBe(0);
        expect(stage.scrollSpeed).toBe(10);
        stage.update(100);
        expect(stage.consumeNextDueEvent()).toBe(EVENTS[0]);
    });

    it('refuses an unsorted script', () => {
        expect(() => createStageModel({ events: [EVENTS[2], EVENTS[0]], scrollSpeed: 10 })).toThrow();
    });
});
