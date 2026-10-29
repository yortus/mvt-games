import { ASAP_STAMP, OP_PLAY, OP_PLAY_OPTIONS } from './commands';
import { HIGHEST_NOTE, LOWEST_NOTE, toNoteNumber } from '../notes';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a sound's data says of how it plays, which a play's options can change. */
export interface PlayDefaults {
    /** The note it plays, as a note number. */
    readonly note: number;
    /** The note it glides to, or NaN for none. */
    readonly glideTo: number;
    /** How long it holds its note, in ms, or `Infinity` until it is stopped. */
    readonly lengthMs: number;
}

/** What a play's options can say, on either chip. Each defaults to the sound's own. */
export interface AnyPlayOptions {
    readonly note?: string | number;
    readonly glideTo?: string | number;
    readonly lengthMs?: number;
    readonly volume?: number;
    readonly pan?: number;
}

/** A play, checked, as the numbers its two commands carry. */
export interface CheckedPlay {
    readonly note: number;
    readonly volume: number;
    /** In ms, or `HELD_LENGTH` to hold the note until it is stopped. */
    readonly lengthMs: number;
    /** A note, or `NO_GLIDE`. */
    readonly glideTo: number;
    /** Where it sits, from -1 (left) to 1 (right), when `hasPan` is 1. */
    readonly pan: number;
    /** 1 if the play has a pan of its own, or 0 to use the sound's. */
    readonly hasPan: number;
}

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
 * Checks a play of a sound whose data is `data`, with `options`, and gives
 * the numbers its commands carry. Throws an error that starts with `play:`
 * if an option is out of range. A play is made only as something happens,
 * such as a shot being fired, so the record it makes costs nothing that
 * matters.
 */
export function checkPlay(data: PlayDefaults, options: AnyPlayOptions | undefined): CheckedPlay {
    const glideTo = options?.glideTo === undefined ? data.glideTo : toPlayNote(options.glideTo, 'play: glideTo');
    const pan = options?.pan;
    return {
        note: options?.note === undefined ? data.note : toPlayNote(options.note, 'play: note'),
        volume: toPlayVolume(options?.volume ?? 1),
        lengthMs: toPlayLength(options?.lengthMs ?? data.lengthMs),
        glideTo: Number.isNaN(glideTo) ? NO_GLIDE : glideTo,
        pan: pan ?? 0,
        hasPan: pan === undefined ? 0 : 1,
    };
}

/** Writes `play` of sound `soundId`, as play `playId`, as its two commands, to play as soon as they arrive. */
export function writePlay(
    write: (op: number, stamp: number, a: number, b: number, c: number, d: number) => void,
    soundId: number,
    playId: number,
    play: CheckedPlay,
): void {
    write(OP_PLAY_OPTIONS, ASAP_STAMP, play.lengthMs, play.glideTo, play.pan, play.hasPan);
    write(OP_PLAY, ASAP_STAMP, soundId, playId, play.note, play.volume);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The note number a play's `note` or `glideTo` option names: a name such as
 * `E-5`, or a note number, where 60 is middle C. Throws an error that starts
 * with `where` if it is not a note in range.
 */
function toPlayNote(value: string | number, where: string): number {
    const note = typeof value === 'number' ? value : toNoteNumber(value);
    if (note === undefined) throw new Error(`${where}: '${value}' is not a note (write C-4, F#5, or a note number)`);
    if (!(note >= LOWEST_NOTE && note <= HIGHEST_NOTE)) throw new Error(`${where}: ${value} is not a note from ${LOWEST_NOTE} to ${HIGHEST_NOTE}`);
    return note;
}

/** A play's length as its command carries it: in ms, or `HELD_LENGTH` for `Infinity`. Throws if it is not above 0. */
function toPlayLength(lengthMs: number): number {
    if (lengthMs === Infinity) return HELD_LENGTH;
    if (!(lengthMs > 0 && lengthMs < Infinity)) throw new Error(`play: lengthMs must be above 0, or Infinity to hold the note; got ${lengthMs}`);
    return lengthMs;
}

/** A play's volume, checked. Throws if it is not 0 or more. */
function toPlayVolume(volume: number): number {
    if (!(volume >= 0 && volume < Infinity)) throw new Error(`play: volume must be 0 or more; got ${volume}`);
    return volume;
}
