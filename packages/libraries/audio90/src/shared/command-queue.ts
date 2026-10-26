import { COMMAND_STRIDE } from './commands';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The commands waiting to be applied, sorted by stamp with the earliest
 * first. They are kept in one preallocated `Float64Array`, so adding and
 * removing commands allocates nothing.
 */
export interface CommandQueue {
    /** How many commands the queue holds at most. */
    readonly capacity: number;
    /** How many commands are waiting. */
    readonly length: number;
    /**
     * The queue's storage, with `COMMAND_STRIDE` numbers per command. The
     * waiting commands start at `head`, in stamp order. Read it, but never
     * write it.
     */
    readonly buffer: Float64Array;
    /** Where the earliest command starts in `buffer`, or -1 if the queue is empty. */
    readonly head: number;
    /**
     * Copies the command that starts at `from` in `commands` into the queue.
     * It goes after every command stamped at or before it, so commands with
     * equal stamps keep their order. Returns true if the command was queued.
     *
     * Returns false, and drops the command, if the queue is full. It does the
     * same if the stamp is NaN or `+Infinity`, or if any operand is not
     * finite. A stamp of `-Infinity`, which means as soon as possible, is
     * allowed.
     */
    insert: (commands: Float64Array, from: number) => boolean;
    /** Removes the earliest command. Does nothing if the queue is empty. */
    removeHead: () => void;
    /** Removes every command. */
    clear: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a `CommandQueue`. */
export interface CommandQueueOptions {
    /** How many commands the queue holds at most. */
    readonly capacity: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an empty command queue. */
export function createCommandQueue(options: CommandQueueOptions): CommandQueue {
    const capacity = Math.max(1, Math.floor(options.capacity));
    const buffer = new Float64Array(capacity * COMMAND_STRIDE);
    // The waiting commands run from `first` up to, but not including, `end`.
    // These count commands, not numbers
    let first = 0;
    let end = 0;

    const queue: CommandQueue = {
        capacity,
        get length() {
            return end - first;
        },
        buffer,
        get head() {
            return first < end ? first * COMMAND_STRIDE : -1;
        },

        insert(commands, from) {
            if (!isValid(commands, from)) return false;
            if (end >= capacity) {
                if (first === 0) return false;
                // Move the waiting commands down to make room at the end
                buffer.copyWithin(0, first * COMMAND_STRIDE, end * COMMAND_STRIDE);
                end -= first;
                first = 0;
            }
            const stamp = commands[from + 1];
            let at = end;
            while (at > first && buffer[(at - 1) * COMMAND_STRIDE + 1] > stamp) at--;
            if (at < end) buffer.copyWithin((at + 1) * COMMAND_STRIDE, at * COMMAND_STRIDE, end * COMMAND_STRIDE);
            for (let i = 0; i < COMMAND_STRIDE; i++) buffer[at * COMMAND_STRIDE + i] = commands[from + i];
            end++;
            return true;
        },

        removeHead() {
            if (first >= end) return;
            first++;
            if (first === end) first = end = 0;
        },

        clear() {
            first = end = 0;
        },
    };

    return queue;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Whether a command can be queued. A single NaN or infinite operand would
 * reach the filters, the echo or the mix. It would stay there and silence
 * the chip until a reset.
 */
function isValid(commands: Float64Array, from: number): boolean {
    const stamp = commands[from + 1];
    if (Number.isNaN(stamp) || stamp === Infinity) return false;
    for (let i = 2; i < COMMAND_STRIDE; i++) {
        if (!Number.isFinite(commands[from + i])) return false;
    }
    return true;
}
