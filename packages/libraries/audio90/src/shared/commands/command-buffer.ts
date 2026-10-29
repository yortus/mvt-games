import { COMMAND_STRIDE } from './commands';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A growing buffer of commands, as a chip's writer fills it. It appends each
 * command to a `Float64Array`, so writing allocates nothing until the buffer
 * is full, when it doubles.
 */
export interface CommandBuffer {
    /**
     * The commands written since the last `clear`. Only the first `count` are
     * in use. Each command takes `COMMAND_STRIDE` numbers.
     */
    readonly commands: Float64Array;
    /** How many commands have been written since the last `clear`. */
    readonly count: number;
    /** Appends one command. */
    write: (op: number, stamp: number, a: number, b: number, c: number, d: number) => void;
    /** Empties the buffer, keeping its array to write into again. */
    clear: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a command buffer. */
export interface CommandBufferOptions {
    /** How many commands it holds before it grows. Defaults to 256. */
    readonly capacity?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a command buffer with nothing written. */
export function createCommandBuffer(options: CommandBufferOptions = {}): CommandBuffer {
    let commands = new Float64Array(Math.max(1, options.capacity ?? DEFAULT_CAPACITY) * COMMAND_STRIDE);
    let count = 0;

    return {
        get commands() {
            return commands;
        },
        get count() {
            return count;
        },

        write(op, stamp, a, b, c, d) {
            if ((count + 1) * COMMAND_STRIDE > commands.length) {
                const grown = new Float64Array(commands.length * 2);
                grown.set(commands.subarray(0, count * COMMAND_STRIDE));
                commands = grown;
            }
            const at = count * COMMAND_STRIDE;
            commands[at] = op;
            commands[at + 1] = stamp;
            commands[at + 2] = a;
            commands[at + 3] = b;
            commands[at + 4] = c;
            commands[at + 5] = d;
            count++;
        },

        clear() {
            count = 0;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_CAPACITY = 256;
