import { createCommandQueue } from './command-queue';
import { COMMAND_STRIDE } from '../commands';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A synthesiser's queue of stamped commands, which renders a block of
 * samples in runs: it applies the commands due at the start of a run, has
 * the synthesiser render up to the next one due, and repeats.
 */
export interface CommandScheduler {
    /**
     * Queues `count` commands to apply at their stamps. Each takes
     * `COMMAND_STRIDE` numbers. The commands are copied, so the caller can
     * reuse `commands` at once.
     *
     * A command that arrives while the queue is full is dropped. So is one
     * whose stamp is NaN or `+Infinity`, or whose operands are not all finite.
     */
    enqueue: (commands: Float64Array, count: number) => void;
    /**
     * Renders `frames` samples from index `offset`, through `renderRun`,
     * applying each command at its sample. The first sample is at chip time
     * `fromMs`, and each sample is `msPerSample` ms after the one before. A
     * command applies at the first sample at or after its stamp, and one
     * stamped at or before `fromMs`, or `-Infinity`, at the first. An
     * `msPerSample` of 0 holds chip time still: the voices sound on, and only
     * the commands stamped at or before `fromMs` apply.
     */
    render: (offset: number, frames: number, fromMs: number, msPerSample: number) => void;
    /** Removes every command. */
    clear: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a `CommandScheduler`. */
export interface CommandSchedulerOptions {
    /** How many commands the queue holds. Defaults to 4096. */
    readonly capacity?: number;
    /** Applies the command that starts at `at` in `commands`. */
    readonly apply: (commands: Float64Array, at: number) => void;
    /**
     * Renders `count` samples from index `start`, with no command due among
     * them. It takes whole numbers only, since V8 can box a fractional
     * number passed to a function it does not inline, which would allocate.
     */
    readonly renderRun: (start: number, count: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a scheduler with nothing queued. */
export function createCommandScheduler(options: CommandSchedulerOptions): CommandScheduler {
    const { apply, renderRun } = options;
    const queue = createCommandQueue({ capacity: options.capacity ?? DEFAULT_CAPACITY });
    const queued = queue.buffer;

    return {
        enqueue(commands, count) {
            for (let i = 0; i < count; i++) queue.insert(commands, i * COMMAND_STRIDE);
        },

        render(offset, frames, fromMs, msPerSample) {
            let done = 0;
            for (;;) {
                // Apply every command due by sample `done`, and find when the next one is due
                let next = frames;
                for (let at = queue.head; at >= 0; at = queue.head) {
                    const due = toSampleIndex(queued[at + 1], fromMs, msPerSample);
                    if (due > done) {
                        if (due < next) next = due;
                        break;
                    }
                    apply(queued, at);
                    queue.removeHead();
                }
                renderRun(offset + done, next - done);
                done = next;
                if (done >= frames) break;
            }
        },

        clear: queue.clear,
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_CAPACITY = 4096;

/**
 * The index of the sample at or after which a command stamped `stampMs`
 * applies. A stamp of `-Infinity` applies at 0. The small allowance keeps a
 * stamp that falls exactly on a sample from landing a sample late, when
 * rounding leaves the division a hair above a whole number.
 */
function toSampleIndex(stampMs: number, fromMs: number, msPerSample: number): number {
    if (stampMs <= fromMs) return 0;
    return Math.ceil((stampMs - fromMs) / msPerSample - 1e-9);
}
