import { describe, expect, it } from 'vitest';
import { createChipClock } from './chip-clock';

const SAMPLE_RATE = 48000;
const BLOCK = 128;
const BLOCK_MS = BLOCK * 1000 / SAMPLE_RATE;
const FRAME_MS = 1000 / 60;
const LEAD_MS = 35;

describe('chip clock', () => {
    it('stays silent until it has a full lead, then fades in', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(true);
        clock.receive(0);
        clock.receive(FRAME_MS);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(true);
        clock.receive(LEAD_MS + 1);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(false);
        expect(clock.gainFrom).toBe(0);
        expect(clock.gainTo).toBe(1);
    });

    it('never runs dry with steady ticks, and keeps its lead', () => {
        const result = simulate({ seconds: 60, tickGapMs: () => FRAME_MS });
        expect(result.dryRuns).toBe(0);
        expect(result.finalLeadMs).toBeCloseTo(LEAD_MS, 0);
    });

    it('never runs dry with ticks that jitter by several ms', () => {
        const random = createSeededRandom(7);
        const result = simulate({ seconds: 60, tickGapMs: () => FRAME_MS + (random() - 0.5) * 12 });
        expect(result.dryRuns).toBe(0);
    });

    for (const drift of [0.003, -0.003]) {
        it(`keeps its lead when chip time runs ${(Math.abs(drift) * 100).toFixed(1)}% ${drift > 0 ? 'fast' : 'slow'} against the sound card`, () => {
            const result = simulate({ seconds: 120, tickGapMs: () => FRAME_MS, drift });
            expect(result.dryRuns).toBe(0);
            expect(result.jumps).toBe(0);
            expect(Math.abs(result.finalLeadMs - LEAD_MS)).toBeLessThan(10);
        });
    }

    it('runs dry over a long gap between ticks, fading out, and recovers', () => {
        const result = simulate({ seconds: 4, tickGapMs: (atMs) => (atMs > 2000 && atMs < 2100 ? 250 : FRAME_MS) });
        expect(result.dryRuns).toBe(1);
        expect(result.fadeOuts).toBe(1);
        expect(result.isPlayingAtEnd).toBe(true);
    });

    it('holds where it is while ticks stop, as they do when the game is paused', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        let horizon = 0;
        for (let i = 0; i < 10; i++) {
            horizon += FRAME_MS;
            clock.receive(horizon);
        }
        for (let i = 0; i < 200; i++) clock.plan(BLOCK);
        expect(clock.isPlaying).toBe(false);
        expect(clock.playheadMs).toBeLessThanOrEqual(horizon);
        expect(clock.playheadMs).toBeGreaterThan(horizon - 1);
    });

    it('starts again with just a full lead after a 150 ms late frame has run it dry', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        let horizon = 0;
        for (let i = 0; i < 10; i++) {
            horizon += FRAME_MS;
            clock.receive(horizon);
        }
        // While the frame is late, blocks play on with no tick, and the clock runs dry
        for (let i = 0; i < 20; i++) clock.plan(BLOCK);
        expect(clock.isPlaying).toBe(false);
        horizon += 150;
        clock.receive(horizon);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(false);
        expect(clock.fromMs).toBeCloseTo(horizon - LEAD_MS, 6);
    });

    it('jumps forward when far behind the newest tick', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS, maxLeadMs: 100 });
        clock.receive(0);
        clock.receive(50);
        clock.plan(BLOCK);
        clock.receive(1000);
        clock.plan(BLOCK);
        expect(clock.fromMs).toBeCloseTo(1000 - LEAD_MS, 6);
    });

    it('plays chip time at the sound card\'s rate when the lead is on target', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        clock.receive(0);
        clock.receive(LEAD_MS);
        clock.plan(BLOCK);
        expect(clock.msPerSample).toBeCloseTo(1000 / SAMPLE_RATE, 9);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SimulateOptions {
    readonly seconds: number;
    /** The real time between ticks, given the real time now. */
    readonly tickGapMs: (atMs: number) => number;
    /** How much more chip time each tick gives than the real time between ticks. */
    readonly drift?: number;
}

/** Ticks and sound card blocks, interleaved in real time. */
function simulate(options: SimulateOptions) {
    const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
    const endMs = options.seconds * 1000;
    let lastTickMs = 0;
    let nextTickMs = 0;
    let nextBlockMs = 0;
    let horizon = 0;
    let dryRuns = 0;
    let fadeOuts = 0;
    let jumps = 0;
    let hasStarted = false;
    let lastFrom = 0;
    while (nextTickMs < endMs || nextBlockMs < endMs) {
        if (nextTickMs <= nextBlockMs) {
            // As in a game loop, each tick advances chip time by the real time since the last tick
            horizon += (nextTickMs - lastTickMs) * (1 + (options.drift ?? 0));
            clock.receive(horizon);
            lastTickMs = nextTickMs;
            nextTickMs += options.tickGapMs(nextTickMs);
            continue;
        }
        const wasPlaying = clock.isPlaying;
        clock.plan(BLOCK);
        if (!clock.isSilent) {
            if (hasStarted && clock.fromMs - lastFrom > BLOCK_MS * 2) jumps++;
            hasStarted = true;
            lastFrom = clock.fromMs;
            if (clock.gainTo === 0) fadeOuts++;
        }
        if (wasPlaying && !clock.isPlaying) dryRuns++;
        nextBlockMs += BLOCK_MS;
    }
    return { dryRuns, fadeOuts, jumps, finalLeadMs: clock.leadMs, isPlayingAtEnd: clock.isPlaying };
}

/** Creates a small seeded random number generator, so the jitter is the same every run. */
function createSeededRandom(seed: number): () => number {
    let state = seed;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}
