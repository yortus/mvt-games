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

/** The stamp of a write played as soon as it arrives, such as a sound effect. */
export const ASAP_STAMP = -Infinity;

/** A chip's mix buses: one for the voices playing music, one for those playing sound effects. */
export type MixBus = 'music' | 'effects';

/** Each mix bus's number in a chip's mix command. */
export const MIX_BUS_INDEX: Readonly<Record<MixBus, number>> = { music: 0, effects: 1 };

/**
 * A tick's commands, as the main thread sends them to a chip's worklet. Only
 * the first `count` commands of `commands` are in use. `horizonMs` is the
 * chip's time at the end of the tick, which the worklet's clock follows.
 */
export interface ChipBatch {
    readonly kind: 'batch';
    readonly commands: Float64Array;
    readonly count: number;
    readonly horizonMs: number;
}

/** What a chip's worklet sends back: a batch's buffer, so the main thread can write into it again. */
export interface ChipReply {
    readonly kind: 'buffer';
    readonly commands: Float64Array;
}
