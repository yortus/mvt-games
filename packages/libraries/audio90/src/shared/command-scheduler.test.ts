import { describe, expect, it } from 'vitest';
import { type CommandScheduler, createCommandScheduler } from './command-scheduler';
import { COMMAND_STRIDE } from './commands';

describe('command scheduler', () => {
    it('applies each command at the first sample at or after its stamp, rendering the runs between', () => {
        const { scheduler, applied, runs } = setUp();
        scheduler.enqueue(toCommands([1, 2.5 * MS_PER_SAMPLE], [2, 7 * MS_PER_SAMPLE]), 2);
        scheduler.render(0, BLOCK, 0, MS_PER_SAMPLE);
        expect(runs).toEqual([[0, 3], [3, 7], [7, BLOCK]]);
        expect(applied).toEqual([1, 2]);
    });

    it('applies a command stamped on a sample at that sample, though rounding puts the stamp a hair after it', () => {
        // The block starts at sample 128, and the stamp is sample 129's time. In floating point, the gap between them comes to a hair more than one sample
        const { scheduler, runs } = setUp();
        scheduler.enqueue(toCommands([1, 129 * MS_PER_SAMPLE]), 1);
        scheduler.render(0, BLOCK, 128 * MS_PER_SAMPLE, MS_PER_SAMPLE);
        expect(runs).toEqual([[0, 1], [1, BLOCK]]);
    });

    it('applies a command stamped -Infinity, or before the block, at its first sample', () => {
        const { scheduler, applied, runs } = setUp();
        scheduler.enqueue(toCommands([1, -Infinity], [2, 10]), 2);
        scheduler.render(0, BLOCK, 20, MS_PER_SAMPLE);
        expect(runs).toEqual([[0, BLOCK]]);
        expect(applied).toEqual([1, 2]);
    });

    it('holds chip time still at 0 ms a sample, applying only what is already due', () => {
        const { scheduler, applied, runs } = setUp();
        scheduler.enqueue(toCommands([1, 0], [2, MS_PER_SAMPLE]), 2);
        scheduler.render(0, BLOCK, 0, 0);
        expect(runs).toEqual([[0, BLOCK]]);
        expect(applied).toEqual([1]);
    });

    it('renders from the offset it is given', () => {
        const { scheduler, runs } = setUp();
        scheduler.enqueue(toCommands([1, 3 * MS_PER_SAMPLE]), 1);
        scheduler.render(100, 10, 0, MS_PER_SAMPLE);
        expect(runs).toEqual([[100, 103], [103, 110]]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MS_PER_SAMPLE = 1000 / 48000;
const BLOCK = 128;

/** A scheduler that records the opcode of each command it applies, and each run of samples it renders, as [from, to]. */
function setUp(): { scheduler: CommandScheduler; applied: number[]; runs: [number, number][] } {
    const applied: number[] = [];
    const runs: [number, number][] = [];
    const scheduler = createCommandScheduler({
        apply: (commands, at) => applied.push(commands[at]),
        renderRun: (start, count) => runs.push([start, start + count]),
    });
    return { scheduler, applied, runs };
}

/** Commands of the given opcodes and stamps, with every operand 0. */
function toCommands(...commands: [op: number, stampMs: number][]): Float64Array {
    const buffer = new Float64Array(commands.length * COMMAND_STRIDE);
    commands.forEach(([op, stampMs], i) => buffer.set([op, stampMs], i * COMMAND_STRIDE));
    return buffer;
}
