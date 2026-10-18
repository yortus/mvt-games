import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPerformanceMeter, type PerformanceMeterOptions } from './performance-meter';
import { addReads, tickCounter } from './view-tick-api';

/** A meter on a clock stepped by hand, and a frame of a loop that drives it. */
function setup(options: PerformanceMeterOptions = {}) {
    let nowMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    const meter = createPerformanceMeter({ windowMs: WINDOW_MS, ...options });

    /** One frame: `work` (the frame's update, refresh and draw) takes `busyMs`, and the frame `frameMs` in all. */
    function frame(frameMs: number, busyMs: number, work?: () => void): void {
        meter.startFrame();
        work?.();
        nowMs += busyMs;
        meter.endFrame();
        nowMs += frameMs - busyMs;
    }

    return { meter, frame };
}

const WINDOW_MS = 100;

describe('a performance meter', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        tickCounter.isCounting = false;
    });

    it('publishes frames per second and CPU time per frame as each window closes', () => {
        const { meter, frame } = setup();
        expect(meter.sampleCount).toBe(0);

        for (let i = 0; i < 12; i++) frame(10, 4);

        expect(meter.sampleCount).toBe(1);
        expect(meter.fps).toBeCloseTo(100, 0);
        expect(meter.cpuMs).toBeCloseTo(4, 5);
        expect(meter.gpuMs).toBeUndefined();
        expect(meter.historyAt('cpuMs', meter.historyLength - 1)).toBeCloseTo(4, 5);
    });

    it('takes the GPU time as each window closes, and keeps the last one through a window with none', () => {
        const gpuTimes = [2, undefined];
        const { meter, frame } = setup({ takeGpuMs: () => gpuTimes.shift() });

        for (let i = 0; i < 12; i++) frame(10, 4);
        expect(meter.gpuMs).toBe(2);
        for (let i = 0; i < 10; i++) frame(10, 4);
        expect(meter.sampleCount).toBe(2);
        expect(meter.gpuMs).toBe(2);
    });

    it('counts the ticks of one frame in each window, and leaves the counter off otherwise', () => {
        const { meter, frame } = setup();

        let countingFrames = 0;
        for (let i = 0; i < 40; i++) {
            frame(10, 4, () => {
                if (tickCounter.isCounting) countingFrames++;
                addReads(250);
            });
        }

        expect(meter.reads).toBe(250);
        // About one frame in each window of ten frames
        expect(countingFrames).toBeGreaterThanOrEqual(3);
        expect(countingFrames).toBeLessThanOrEqual(4);
    });

    it('switches the counter off when destroyed in the middle of a sample', () => {
        const { meter, frame } = setup();
        frame(10, 4);
        expect(tickCounter.isCounting).toBe(true);

        meter.destroy();

        expect(tickCounter.isCounting).toBe(false);
    });
});
