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
    /**
     * Starts the next batch of commands. If `buffer` is given and big enough,
     * the batch reuses it. If not, the buffer makes a new array. Passing back
     * an array that was sent earlier avoids allocating a new one.
     *
     * The batch just sent may have been transferred to another thread. That
     * empties its array, whose length then reads 0. The buffer never reads it
     * again.
     */
    clear: (buffer?: Float64Array) => void;
}

/**
 * What every chip's writer has beside the chip's own methods: its clock, the
 * commands written, and what the browser's chip and the headless chip need
 * to send them on. The chip's controls are made from it.
 */
export interface CommandWriter extends Pick<CommandBuffer, 'commands' | 'count' | 'clear'> {
    /** The writer's clock, in ms, which stamps each write made with no `atMs`. `-Infinity` for a writer with no clock. */
    readonly time: number;
    /** Advances `time` by `deltaMs`, in ms. */
    update: (deltaMs: number) => void;
    /** Forgets every id. Each sound and sample is then passed on again the next time it is played. */
    forget: () => void;
}

/**
 * A chip's writer as the chip that owns it uses it: a `CommandWriter` that
 * also plays and stops sounds, and numbers the chip's plays. `Sound` and
 * `PlayOptions` are the chip's own types.
 */
export interface PlayingWriter<Sound, PlayOptions> extends CommandWriter {
    /** Plays `sound`, and returns the play's id. */
    play: (sound: Sound, options?: PlayOptions) => number;
    /** Releases the note of the play with id `id`. */
    stop: (id: number) => void;
    /** Releases every voice's note. */
    releaseAll: () => void;
    /** Takes the next play's id, for a play the writer doesn't write itself, such as a song's. */
    takePlayId: () => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a command buffer. */
export interface CommandBufferOptions {
    /** How many commands it holds before it grows. Defaults to 256. */
    readonly capacity?: number;
    /** Called as a command is written into an empty batch, so the code that sends the batches knows there is one to send. */
    readonly onFirstWrite?: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a command buffer with nothing written. */
export function createCommandBuffer(options: CommandBufferOptions = {}): CommandBuffer {
    // A batch's size in numbers, kept apart from the buffer's: a buffer sent
    // to another thread is detached, and its length reads 0
    let size = Math.max(1, options.capacity ?? DEFAULT_CAPACITY) * COMMAND_STRIDE;
    let commands: Float64Array = new Float64Array(size);
    let count = 0;
    const { onFirstWrite } = options;

    return {
        get commands() {
            return commands;
        },
        get count() {
            return count;
        },

        write(op, stamp, a, b, c, d) {
            if ((count + 1) * COMMAND_STRIDE > commands.length) {
                size = Math.max(size, commands.length) * 2;
                const grown = new Float64Array(size);
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
            if (count === 1) onFirstWrite?.();
        },

        clear(buffer) {
            commands = buffer !== undefined && buffer.length >= size ? buffer : new Float64Array(size);
            count = 0;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_CAPACITY = 256;
