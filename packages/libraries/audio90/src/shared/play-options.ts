import { HIGHEST_NOTE, LOWEST_NOTE, toNoteNumber } from './notes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** A play's length in its command when it holds its note until it is stopped. */
export const HELD_LENGTH = -1;

/** A play's glide note in its command when it doesn't glide. */
export const NO_GLIDE = -1;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The note number a play's `note` or `glideTo` option names: a name such as
 * `E-5`, or a note number, where 60 is middle C. Throws an error that starts
 * with `where` if it is not a note in range.
 */
export function toPlayNote(value: string | number, where: string): number {
    const note = typeof value === 'number' ? value : toNoteNumber(value);
    if (note === undefined) throw new Error(`${where}: '${value}' is not a note (write C-4, F#5, or a note number)`);
    if (!(note >= LOWEST_NOTE && note <= HIGHEST_NOTE)) throw new Error(`${where}: ${value} is not a note from ${LOWEST_NOTE} to ${HIGHEST_NOTE}`);
    return note;
}

/** A play's length as its command carries it: in ms, or `HELD_LENGTH` for `Infinity`. Throws if it is not above 0. */
export function toPlayLength(lengthMs: number): number {
    if (lengthMs === Infinity) return HELD_LENGTH;
    if (!(lengthMs > 0 && lengthMs < Infinity)) throw new Error(`play: lengthMs must be above 0, or Infinity to hold the note; got ${lengthMs}`);
    return lengthMs;
}

/** A play's volume, checked. Throws if it is not 0 or more. */
export function toPlayVolume(volume: number): number {
    if (!(volume >= 0 && volume < Infinity)) throw new Error(`play: volume must be 0 or more; got ${volume}`);
    return volume;
}
