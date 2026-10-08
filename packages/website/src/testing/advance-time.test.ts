import { Container } from 'pixi.js';
import { setUpdate } from '@mvtjs/pixi';
import { describe, expect, it } from 'vitest';
import { advanceTime } from './advance-time';

describe('advanceTime', () => {
    it('advances in frame-sized steps, the last one short', async () => {
        const steps: number[] = [];
        await advanceTime({ models: [{ update: (ms) => steps.push(ms) }], totalMs: 40 });
        expect(steps).toEqual([16, 16, 8]);
    });

    it('updates every model, then every view, each step', async () => {
        const calls: string[] = [];
        const view = new Container();
        setUpdate(view, () => {
            calls.push('view');
        });
        await advanceTime({
            models: [{ update: () => calls.push('a') }, { update: () => calls.push('b') }],
            views: [view],
            totalMs: 32,
        });
        expect(calls).toEqual(['a', 'b', 'view', 'a', 'b', 'view']);
    });

    it('lets a model awaiting a promise move on between steps', async () => {
        let resolved = 0;
        const model = {
            update: () => {
                void Promise.resolve().then(() => resolved++);
            },
        };
        await advanceTime({ models: [model], totalMs: 48 });
        expect(resolved).toBe(3);
    });

    it('takes the step size asked for', async () => {
        const steps: number[] = [];
        await advanceTime({ models: [{ update: (ms) => steps.push(ms) }], totalMs: 25, stepMs: 10 });
        expect(steps).toEqual([10, 10, 5]);
    });
});
