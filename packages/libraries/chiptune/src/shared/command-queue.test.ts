import { describe, expect, it } from 'vitest';
import { createCommandQueue, type CommandQueue } from './command-queue';
import { COMMAND_STRIDE } from './commands';

describe('command queue', () => {
    it('returns commands in stamp order, earliest first', () => {
        const queue = createCommandQueue({ capacity: 8 });
        for (const stamp of [30, 10, 20, -Infinity]) queue.insert(createCommand(stamp, 0), 0);
        expect(drain(queue).map(([stamp]) => stamp)).toEqual([-Infinity, 10, 20, 30]);
    });

    it('keeps commands with equal stamps in the order they arrived', () => {
        const queue = createCommandQueue({ capacity: 8 });
        for (let i = 0; i < 4; i++) queue.insert(createCommand(10, i), 0);
        queue.insert(createCommand(5, 99), 0);
        expect(drain(queue).map(([, tag]) => tag)).toEqual([99, 0, 1, 2, 3]);
    });

    it('drops the incoming command when full, whatever its stamp', () => {
        const capacity = 4;
        const queue = createCommandQueue({ capacity });
        for (let i = 0; i < capacity; i++) expect(queue.insert(createCommand(100 + i, i), 0)).toBe(true);
        expect(queue.insert(createCommand(0, 99), 0)).toBe(false);
        expect(drain(queue).map(([, tag]) => tag)).toEqual([0, 1, 2, 3]);
    });

    it('accepts commands again once the earliest have been removed', () => {
        const capacity = 4;
        const queue = createCommandQueue({ capacity });
        for (let i = 0; i < capacity; i++) queue.insert(createCommand(i, i), 0);
        queue.removeHead();
        queue.removeHead();
        expect(queue.insert(createCommand(10, 10), 0)).toBe(true);
        expect(queue.insert(createCommand(1.5, 15), 0)).toBe(true);
        expect(queue.length).toBe(capacity);
        expect(drain(queue).map(([, tag]) => tag)).toEqual([15, 2, 3, 10]);
    });

    it('rejects a stamp of NaN or +Infinity, and accepts -Infinity', () => {
        const queue = createCommandQueue({ capacity: 8 });
        expect(queue.insert(createCommand(Number.NaN, 0), 0)).toBe(false);
        expect(queue.insert(createCommand(Infinity, 0), 0)).toBe(false);
        expect(queue.insert(createCommand(-Infinity, 0), 0)).toBe(true);
        expect(queue.length).toBe(1);
    });

    it('rejects a command with any operand that is not finite', () => {
        const queue = createCommandQueue({ capacity: 8 });
        for (let operand = 2; operand < COMMAND_STRIDE; operand++) {
            for (const bad of [Number.NaN, Infinity, -Infinity]) {
                const commands = createCommand(0, 0);
                commands[operand] = bad;
                expect(queue.insert(commands, 0)).toBe(false);
            }
        }
        expect(queue.length).toBe(0);
    });

    it('copies a command from where it starts in a batch', () => {
        const queue = createCommandQueue({ capacity: 8 });
        const batch = new Float64Array(2 * COMMAND_STRIDE);
        batch.set(createCommand(5, 1), 0);
        batch.set(createCommand(6, 2), COMMAND_STRIDE);
        queue.insert(batch, COMMAND_STRIDE);
        batch.fill(0);
        expect(drain(queue)).toEqual([[6, 2]]);
    });

    it('reports -1 as its head when empty, and empties on clear', () => {
        const queue = createCommandQueue({ capacity: 8 });
        expect(queue.head).toBe(-1);
        queue.insert(createCommand(1, 1), 0);
        expect(queue.head).toBeGreaterThanOrEqual(0);
        queue.clear();
        expect(queue.head).toBe(-1);
        expect(queue.length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates one command, `[1, stamp, tag, 0, 0, 0]`. Its first operand is a tag that tells it apart from the others. */
function createCommand(stamp: number, tag: number): Float64Array {
    const commands = new Float64Array(COMMAND_STRIDE);
    commands[0] = 1;
    commands[1] = stamp;
    commands[2] = tag;
    return commands;
}

/** Removes every command, and returns each one's stamp and tag. */
function drain(queue: CommandQueue): [number, number][] {
    const taken: [number, number][] = [];
    for (let at = queue.head; at >= 0; at = queue.head) {
        taken.push([queue.buffer[at + 1], queue.buffer[at + 2]]);
        queue.removeHead();
    }
    return taken;
}
