// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * How many numbers each command takes. Writes to a chip travel as commands
 * in a `Float64Array`, so writing one allocates nothing. Each command is
 * `[opcode, stampMs, a, b, c, d]`. The opcode says what the command does,
 * and each chip numbers its own. The stamp is the chip time the command
 * applies at, in ms. A stamp of `-Infinity` means as soon as possible.
 *
 * A chip's synthesiser drops a command whose stamp is NaN or `+Infinity`. It
 * also drops one whose operands `a` to `d` are not all finite.
 */
export const COMMAND_STRIDE = 6;

/** The stamp of a write played as soon as it arrives, such as a sound played on its own. */
export const ASAP_STAMP = -Infinity;

/**
 * A batch of commands, as the main thread sends them to a chip's worklet.
 * Only the first `count` commands of `commands` are in use.
 */
export interface ChipBatch {
    readonly kind: 'batch';
    readonly commands: Float64Array;
    readonly count: number;
}

/**
 * What a chip's worklet sends back about its own running: a batch's buffer,
 * so the main thread can write into it again, or where its clock is.
 */
export type ChipReply = ChipBufferReply | ChipClockReply;

/** A batch's buffer, sent back as the batch arrives, so the main thread can write into it again. */
export interface ChipBufferReply {
    readonly kind: 'buffer';
    readonly commands: Float64Array;
}

/**
 * Where the worklet's clock is, sent as the clock first plays, and each time
 * it pauses or resumes. Until the next, chip time moves on from `playheadMs`
 * by `msPerSample` for each frame after `frame`.
 */
export interface ChipClockReply {
    readonly kind: 'clock';
    /** The chip time, in ms, that the block at `frame` starts at. */
    readonly playheadMs: number;
    /** The audio context's count of frames, at the start of that block. */
    readonly frame: number;
    /** The chip time each sample covers from then on, in ms. It is 0 while the chip is paused. */
    readonly msPerSample: number;
}
