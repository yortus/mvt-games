// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * How many numbers each command takes. Writes to a chip's synthesiser travel
 * as commands in a `Float64Array`, so writing one allocates nothing. Each
 * command is `[opcode, stampMs, a, b, c, d]`. The opcode says what the
 * command does. The opcodes that play and stop sounds, below, are the same
 * on every chip, and each chip numbers its others from 1. The stamp is the
 * chip time the command applies at, in ms. A stamp of `-Infinity` means as
 * soon as possible.
 *
 * A chip's synthesiser drops a command whose stamp is NaN or `+Infinity`. It
 * also drops one whose operands `a` to `d` are not all finite.
 */
export const COMMAND_STRIDE = 6;

/** The stamp of a write played as soon as it arrives, such as a sound played on its own. */
export const ASAP_STAMP = -Infinity;

/**
 * Says how the next `OP_PLAY` plays. `a` is how long it holds its note
 * before releasing it, in ms, or -1 to hold it until it is stopped. `b` is
 * the note it glides to over that time, or -1 for none. On a stereo chip,
 * `c` is where it sits, from -1 (left) to 1 (right), which is used when `d`
 * is 1. When `d` is 0, it sits at the sound's own pan. A play always writes
 * one just before its `OP_PLAY`, with the same stamp.
 */
export const OP_PLAY_OPTIONS = 11;
/**
 * Plays a sound on a voice the chip chooses. `a` is the sound's id, `b` the
 * play's id, `c` the note and `d` the volume. The `OP_PLAY_OPTIONS` written
 * just before it says how long it lasts, where it glides and where it sits.
 */
export const OP_PLAY = 12;
/** Releases the note of a play, if it is still sounding. `a` is the play's id. */
export const OP_STOP = 13;
/** Releases every voice's note. No operands. */
export const OP_RELEASE_ALL = 14;
