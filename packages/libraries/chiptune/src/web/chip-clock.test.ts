import { describe, expect, it } from 'vitest';
import { type ChipClock, createChipClock } from './chip-clock';

const SAMPLE_RATE = 48000;
const BLOCK = 128;
const BLOCK_MS = BLOCK * 1000 / SAMPLE_RATE;
const FRAME_MS = 1000 / 60;
const LEAD_MS = 100;

describe('chip clock', () => {
    it('stays silent until it has a full lead, then fades in', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(true);
        clock.receive(0);
        clock.receive(LEAD_MS / 2);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(true);
        clock.receive(LEAD_MS + 1);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(false);
        expect(clock.gainFrom).toBe(0);
        expect(clock.gainTo).toBe(1);
    });

    it('keeps 100 ms of lead by default', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE });
        clock.receive(0);
        clock.receive(99);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(true);
        clock.receive(100);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(false);
    });

    it('never stalls with steady ticks, and keeps its lead', () => {
        const result = simulate({ seconds: 60, tickGapMs: () => FRAME_MS });
        expect(result.stalls).toBe(0);
        expect(result.finalLeadMs).toBeCloseTo(LEAD_MS, 0);
    });

    it('never stalls with ticks that jitter by several ms', () => {
        const random = createSeededRandom(7);
        const result = simulate({ seconds: 60, tickGapMs: () => FRAME_MS + (random() - 0.5) * 12 });
        expect(result.stalls).toBe(0);
    });

    it('never stalls on a slow device, whose frames are late and uneven and whose sound card asks for 8 blocks at once', () => {
        const random = createSeededRandom(11);
        const result = simulate({ seconds: 60, tickGapMs: () => 2 * FRAME_MS + random() * 20, blocksPerCall: 8 });
        expect(result.stalls).toBe(0);
    });

    it('wins back the lead that frames longer than the longest step lose, and never stalls', () => {
        // Every second and a half, a frame takes 66 ms, but the game loop advances only 50 ms, its longest step
        const result = simulate({ seconds: 60, tickGapMs: (atMs) => (atMs % 1500 < FRAME_MS ? 66 : FRAME_MS), maxStepMs: 50 });
        expect(result.stalls).toBe(0);
        expect(result.finalLeadMs).toBeGreaterThan(LEAD_MS - 20);
    });

    for (const drift of [0.003, -0.003]) {
        it(`keeps its lead when chip time runs ${(Math.abs(drift) * 100).toFixed(1)}% ${drift > 0 ? 'fast' : 'slow'} against the sound card`, () => {
            const result = simulate({ seconds: 120, tickGapMs: () => FRAME_MS, drift });
            expect(result.stalls).toBe(0);
            expect(result.jumps).toBe(0);
            expect(Math.abs(result.finalLeadMs - LEAD_MS)).toBeLessThan(10);
        });
    }

    it('stalls when a tick is later than the lead, with chip time standing still and the voices sounding', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        const horizon = startPlaying(clock);
        planFor(clock, LEAD_MS + 20);
        expect(clock.phase).toBe('stalled');
        expect(clock.stallCount).toBe(1);
        expect(clock.isSilent).toBe(false);
        expect(clock.msPerSample).toBe(0);
        expect(clock.gainTo).toBe(1);
        expect(clock.fromMs).toBeCloseTo(horizon, 6);
    });

    it('plays on from where it stood, without fading, once a stall has half a lead again', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        let horizon = startPlaying(clock);
        planFor(clock, LEAD_MS + 20);
        const stoodAt = clock.playheadMs;
        while (horizon - stoodAt < LEAD_MS / 2) {
            horizon += FRAME_MS;
            clock.receive(horizon);
        }
        clock.plan(BLOCK);
        expect(clock.phase).toBe('playing');
        expect(clock.fromMs).toBeCloseTo(stoodAt, 6);
        expect(clock.gainFrom).toBe(1);
        expect(clock.gainTo).toBe(1);
    });

    it('fades out once a stall lasts, as in a hidden tab, and then waits for a full lead', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        let horizon = startPlaying(clock);
        planFor(clock, LEAD_MS + 1000);
        expect(clock.phase).toBe('waiting');
        expect(clock.isSilent).toBe(true);
        horizon += LEAD_MS / 2;
        clock.receive(horizon);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(true);
        horizon += LEAD_MS;
        clock.receive(horizon);
        clock.plan(BLOCK);
        expect(clock.isSilent).toBe(false);
        expect(clock.gainFrom).toBe(0);
        expect(clock.fromMs).toBeCloseTo(horizon - LEAD_MS, 6);
    });

    it('fades out at once when the ticks bring no chip time, as when the game is paused, and holds where it is', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        const horizon = startPlaying(clock);
        clock.receive(horizon);
        clock.receive(horizon);
        clock.plan(BLOCK);
        expect(clock.phase).toBe('paused');
        expect(clock.gainTo).toBe(0);
        const heldAt = clock.playheadMs;
        for (let i = 0; i < 200; i++) {
            if (i % 6 === 0) clock.receive(horizon);
            clock.plan(BLOCK);
            expect(clock.isSilent).toBe(true);
        }
        expect(clock.playheadMs).toBe(heldAt);
        expect(clock.stallCount).toBe(0);
    });

    it('fades back in at once as the game resumes, from where it paused', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        const horizon = startPlaying(clock);
        clock.receive(horizon);
        clock.receive(horizon);
        clock.plan(BLOCK);
        const heldAt = clock.playheadMs;
        planFor(clock, 2000);
        clock.receive(horizon + FRAME_MS);
        clock.plan(BLOCK);
        expect(clock.phase).toBe('playing');
        expect(clock.fromMs).toBe(heldAt);
        expect(clock.gainFrom).toBe(0);
        expect(clock.gainTo).toBe(1);
    });

    it('plays on through a single tick that brings no chip time', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        const horizon = startPlaying(clock);
        clock.receive(horizon);
        clock.plan(BLOCK);
        clock.receive(horizon + FRAME_MS);
        clock.plan(BLOCK);
        expect(clock.phase).toBe('playing');
        expect(clock.gainTo).toBe(1);
    });

    it('fades out when the ticks come back after a stall but bring no chip time', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        const horizon = startPlaying(clock);
        planFor(clock, LEAD_MS + 20);
        clock.receive(horizon);
        clock.receive(horizon);
        clock.plan(BLOCK);
        expect(clock.phase).toBe('paused');
        expect(clock.gainTo).toBe(0);
    });

    it('jumps forward when far behind the newest tick', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        clock.receive(0);
        clock.receive(LEAD_MS);
        clock.plan(BLOCK);
        clock.receive(2000);
        clock.plan(BLOCK);
        expect(clock.fromMs).toBeCloseTo(2000 - LEAD_MS, 6);
    });

    it('plays chip time at the sound card\'s rate when the lead is on target', () => {
        const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        clock.receive(0);
        clock.receive(LEAD_MS);
        clock.plan(BLOCK);
        expect(clock.msPerSample).toBeCloseTo(1000 / SAMPLE_RATE, 9);
    });

    it('plays chip time up to 2% slower when the lead is short, and only 0.5% faster when it is long', () => {
        // Ticks that bring almost no chip time shorten the smoothed lead a long way
        const short = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        short.receive(0);
        short.receive(LEAD_MS);
        short.plan(BLOCK);
        planFor(short, LEAD_MS * 0.8);
        for (let i = 1; i <= 100; i++) short.receive(LEAD_MS + 0.01 * i);
        short.plan(BLOCK);
        expect(short.msPerSample).toBeCloseTo(1000 / SAMPLE_RATE * 0.98, 9);

        const long = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
        long.receive(0);
        long.receive(LEAD_MS);
        long.plan(BLOCK);
        for (let i = 1; i <= 100; i++) long.receive(LEAD_MS + i);
        long.plan(BLOCK);
        expect(long.msPerSample).toBeCloseTo(1000 / SAMPLE_RATE * 1.005, 9);
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
    /**
     * How many blocks the sound card asks for at once. No tick arrives
     * between them. Defaults to 1. A phone's sound card often asks for
     * several at a time.
     */
    readonly blocksPerCall?: number;
    /** The most chip time one tick brings, as a game loop clamps a long frame's step. Defaults to no limit. */
    readonly maxStepMs?: number;
}

/** Ticks and sound card blocks, interleaved in real time. */
function simulate(options: SimulateOptions) {
    const clock = createChipClock({ sampleRate: SAMPLE_RATE, leadMs: LEAD_MS });
    const blocksPerCall = options.blocksPerCall ?? 1;
    const maxStepMs = options.maxStepMs ?? Infinity;
    const endMs = options.seconds * 1000;
    let lastTickMs = 0;
    let nextTickMs = 0;
    let nextBlockMs = 0;
    let horizon = 0;
    let jumps = 0;
    let hasStarted = false;
    let lastFrom = 0;
    while (nextTickMs < endMs || nextBlockMs < endMs) {
        if (nextTickMs <= nextBlockMs) {
            // As in a game loop, each tick advances chip time by the real time since the last tick
            horizon += Math.min(maxStepMs, (nextTickMs - lastTickMs) * (1 + (options.drift ?? 0)));
            clock.receive(horizon);
            lastTickMs = nextTickMs;
            nextTickMs += options.tickGapMs(nextTickMs);
            continue;
        }
        for (let i = 0; i < blocksPerCall; i++) {
            clock.plan(BLOCK);
            if (clock.isSilent) continue;
            if (hasStarted && clock.fromMs - lastFrom > BLOCK_MS * 2) jumps++;
            hasStarted = true;
            lastFrom = clock.fromMs;
        }
        nextBlockMs += BLOCK_MS * blocksPerCall;
    }
    return { stalls: clock.stallCount, jumps, finalLeadMs: clock.leadMs };
}

/** Gives `clock` steady ticks until it has a full lead, and plans a block, so it plays. Returns the newest chip time it was given. */
function startPlaying(clock: ChipClock): number {
    let horizon = 0;
    clock.receive(horizon);
    while (horizon < LEAD_MS) {
        horizon += FRAME_MS;
        clock.receive(horizon);
    }
    clock.plan(BLOCK);
    expect(clock.phase).toBe('playing');
    return horizon;
}

/** Plans blocks with no tick, for `ms` of the sound card's time. */
function planFor(clock: ChipClock, ms: number): void {
    for (let i = 0; i < Math.round(ms / BLOCK_MS); i++) clock.plan(BLOCK);
}

/** Creates a small seeded random number generator, so the jitter is the same every run. */
function createSeededRandom(seed: number): () => number {
    let state = seed;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}
