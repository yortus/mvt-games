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

    /** A frame that starts, and never says it has ended. */
    function unfinishedFrame(frameMs: number): void {
        meter.startFrame();
        nowMs += frameMs;
    }

    return { meter, frame, unfinishedFrame };
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

    describe('missed frames', () => {
        /** A meter that has seen a display running at `rate`, so it knows the budget. */
        function setupAtRate(rate: number) {
            const context = setup();
            for (let i = 0; i < 12; i++) context.frame(1000 / rate, 1);
            return context;
        }

        it('counts none while frames keep up', () => {
            const { meter, frame } = setupAtRate(100);

            for (let i = 0; i < 40; i++) frame(10, 1);

            expect(meter.sampleCount).toBeGreaterThan(1);
            expect(meter.missedShare).toBe(0);
        });

        it('counts the frames the display could have shown, while the main thread had time to spare', () => {
            const { meter, frame } = setupAtRate(100);

            for (let i = 0; i < 10; i++) frame(40, 1);

            // Each frame took four of the display's frames, so three in every four were missed
            expect(meter.missedShare).toBeCloseTo(0.75, 1);
        });

        it('rises gradually as frames slip by less than a whole frame, with no cliff', () => {
            const shares: number[] = [];
            for (const frameMs of [12, 14, 16, 18]) {
                const { meter, frame } = setupAtRate(100);
                for (let i = 0; i < 30; i++) frame(frameMs, 1);
                shares.push(meter.missedShare);
                expect(meter.missedShare).toBeCloseTo(1 - 10 / frameMs, 1);
            }
            expect(shares).toEqual([...shares].sort((a, b) => a - b));
        });

        it('leaves out frames lost to their own work', () => {
            const { meter, frame } = setupAtRate(100);

            for (let i = 0; i < 10; i++) frame(40, 30);

            expect(meter.missedShare).toBe(0);
        });

        it('takes no notice of frames that arrive unevenly, but on time overall', () => {
            const { meter, frame } = setupAtRate(100);

            for (let i = 0; i < 40; i++) frame(i % 2 === 0 ? 6 : 14, 1);

            expect(meter.missedShare).toBe(0);
        });

        it('goes by the display: the same frame rate misses more on a faster one', () => {
            const atSixty = setupAtRate(60);
            for (let i = 0; i < 20; i++) atSixty.frame(20, 1);

            const atHundred = setupAtRate(100);
            for (let i = 0; i < 20; i++) atHundred.frame(20, 1);

            expect(atHundred.meter.missedShare).toBeGreaterThan(atSixty.meter.missedShare);
        });

        it('still counts them when frames were very slow from the start', () => {
            const { meter, frame } = setup();

            for (let i = 0; i < 10; i++) frame(200, 1);

            // The slowest display it allows for is 30 FPS, so it knows these are slower
            expect(meter.missedShare).toBeCloseTo(1 - (1000 / 30 / 200), 1);
        });

        it('counts none in the first window, before it knows the display, so a slow display raises no alarm', () => {
            const { meter, frame } = setup();

            for (let i = 0; i < 4; i++) frame(1000 / 30, 1);
            expect(meter.sampleCount).toBe(1);
            expect(meter.missedShare).toBe(0);

            for (let i = 0; i < 10; i++) frame(1000 / 30, 1);
            expect(meter.missedShare).toBe(0);
        });

        it('takes a long gap for a hidden page, not for missed frames', () => {
            const { meter, frame } = setupAtRate(100);

            frame(5000, 1);
            for (let i = 0; i < 12; i++) frame(10, 1);

            for (let i = 0; i < meter.historyLength; i++) {
                expect(meter.historyAt('missedShare', i) || 0).toBe(0);
            }
        });

        it('puts the time lost after a frame that never finished down to that frame', () => {
            const { meter, unfinishedFrame } = setupAtRate(100);

            for (let i = 0; i < 10; i++) unfinishedFrame(40);

            expect(meter.missedShare).toBe(0);
        });
    });

    it('switches the counter off when destroyed in the middle of a sample', () => {
        const { meter, frame } = setup();
        frame(10, 4);
        expect(tickCounter.isCounting).toBe(true);

        meter.destroy();

        expect(tickCounter.isCounting).toBe(false);
    });
});
