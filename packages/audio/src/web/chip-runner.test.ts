import { describe, expect, it } from 'vitest';
import { createCommandAudio80 } from '../chip';
import type { ChipReply } from '../core';
import { createInstrument } from '../notation';
import { measurePeak } from '../headless';
import { createChipRunner, type RunnerMessage } from './chip-runner';

const SAMPLE_RATE = 48000;
const BLOCK = 128;
const LEAD_MS = 35;
const TICK_MS = 16;
/** How many blocks of sound play in one tick. Six blocks of 128 samples at 48 kHz last 16 ms. */
const BLOCKS_PER_TICK = Math.round(TICK_MS * SAMPLE_RATE / 1000 / BLOCK);

describe('chip runner', () => {
    it('plays a note once it has a full lead, and sends each batch\'s buffer back', () => {
        const { runner, writer, flush, countHandedBack } = setUp();
        writer.noteOn(0, createInstrument({ wave: 'saw' }), 57, 1);
        flush(0);
        const output = new Float32Array(BLOCK);
        runner.process(output);
        expect(measurePeak(output)).toBe(0);
        for (let tick = 0; tick < 4; tick++) flush(TICK_MS);
        runner.process(output);
        runner.process(output);
        expect(measurePeak(output)).toBeGreaterThan(0);
        expect(countHandedBack()).toBeGreaterThan(0);
    });

    it('plays every batch, not just the first, so a note released in the second tick falls silent', () => {
        const { runner, writer, flush } = setUp();
        const output = new Float32Array(BLOCK);
        // Starts the chip's clock at 0, so that the note below sounds for a tick before it is released
        flush(0);
        writer.noteOn(0, createInstrument({ wave: 'saw', envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 20 } }), 57, 1);
        flush(TICK_MS);
        // Written after a batch was sent and before any buffer has come back
        writer.noteOff(0);
        let loudest = 0;
        for (let tick = 0; tick < 30; tick++) {
            flush(TICK_MS);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) {
                runner.process(output);
                loudest = Math.max(loudest, measurePeak(output));
            }
        }
        expect(loudest).toBeGreaterThan(0);
        expect(measurePeak(output)).toBeLessThan(1e-3);
    });

    it('is silent again after a reset', () => {
        const { runner, writer, flush, receive } = setUp();
        writer.noteOn(0, createInstrument({ wave: 'saw' }), 57, 1);
        for (let i = 0; i < 5; i++) flush(TICK_MS);
        const output = new Float32Array(BLOCK);
        runner.process(output);
        expect(measurePeak(output)).toBeGreaterThan(0);
        receive({ kind: 'reset' });
        for (let i = 0; i < 5; i++) flush(TICK_MS);
        // The first block fades out what was playing. The rest are silent
        runner.process(output);
        for (let i = 0; i < 4; i++) runner.process(output);
        expect(measurePeak(output)).toBe(0);
    });

    it('fades out over one block after a reset, rather than cutting to 0, which would click', () => {
        const { runner, writer, flush, receive } = setUp();
        writer.noteOn(0, createInstrument({ wave: 'saw' }), 57, 1);
        const output = new Float32Array(BLOCK);
        for (let tick = 0; tick < 10; tick++) {
            flush(TICK_MS);
            for (let b = 0; b < BLOCKS_PER_TICK; b++) runner.process(output);
        }
        const last = output[BLOCK - 1];
        expect(Math.abs(last)).toBeGreaterThan(0.01);
        receive({ kind: 'reset' });
        runner.process(output);
        // It steps down by at most one block's share
        expect(Math.abs(output[0] - last)).toBeLessThanOrEqual(Math.abs(last) / BLOCK + 1e-6);
        expect(output[BLOCK - 1]).toBe(0);
        runner.process(output);
        expect(measurePeak(output)).toBe(0);
    });

    it('renders silence once stopped, and says so, so the processor can end', () => {
        const { runner, writer, flush, receive } = setUp();
        writer.noteOn(0, createInstrument({ wave: 'saw' }), 57, 1);
        for (let i = 0; i < 5; i++) flush(TICK_MS);
        const output = new Float32Array(BLOCK);
        expect(runner.isStopped).toBe(false);
        receive({ kind: 'stop' });
        expect(runner.isStopped).toBe(true);
        runner.process(output);
        expect(measurePeak(output)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setUp() {
    const replies: ChipReply[] = [];
    let returned = 0;
    const runner = createChipRunner({
        sampleRate: SAMPLE_RATE,
        leadMs: LEAD_MS,
        sendBack: (reply) => {
            replies.push(reply);
            returned++;
        },
    });
    const receive = (message: RunnerMessage) => runner.receive(message);
    const writer = createCommandAudio80({
        onInstrument: (id, data) => receive({ kind: 'instrument', id, data }),
        onEffect: (id, data) => receive({ kind: 'effect', id, data }),
    });
    /**
     * Runs one tick. It advances the chip's clock, then sends its writes as
     * the browser's chip sends them. The buffer is transferred, which detaches
     * the writer's copy. The writer carries on in a buffer that was sent back,
     * if there is one. A buffer comes back by message, so never before the
     * next tick. So the spare is taken before this tick's batch is sent.
     */
    const flush = (deltaMs: number) => {
        writer.update(deltaMs);
        const spare = replies.pop()?.commands;
        const commands = structuredClone(writer.commands, { transfer: [writer.commands.buffer] });
        receive({ kind: 'batch', commands, count: writer.count, horizonMs: writer.time });
        writer.clear(spare);
    };
    return { runner, writer, flush, receive, countHandedBack: () => returned };
}
