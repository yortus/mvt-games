// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The lowest note number songs and instruments may play, about 8.2 Hz. Notes are numbered as in MIDI. */
export const LOWEST_NOTE = 0;

/** The highest note number songs and instruments may play. It is `G-9`, about 12.5 kHz. Notes are numbered as in MIDI. */
export const HIGHEST_NOTE = 127;

/** `HIGHEST_NOTE` as a song writes it, for error messages. */
export const HIGHEST_NOTE_NAME = 'G-9';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The note number of a note name, or undefined if `name` is not one. Note
 * numbers follow MIDI, where 60 is middle C and 69 is the A at 440 Hz. Names
 * are written as music trackers write them: a letter, `-` or `#`, and an
 * octave, as in `C-4` or `F#5`.
 */
export function toNoteNumber(name: string): number | undefined {
    const match = NOTE_NAME.exec(name);
    if (match === null) return undefined;
    const semitone = SEMITONES[match[1]] + (match[2] === '#' ? 1 : 0);
    return 12 * (Number(match[3]) + 1) + semitone;
}

/** The frequency, in Hz, of a note number, which may be fractional (a note bent by vibrato). */
export function toFrequency(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NOTE_NAME = /^([A-G])([-#])(\d)$/;

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
