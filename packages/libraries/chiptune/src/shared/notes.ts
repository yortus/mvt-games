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

/**
 * The name of a note number, as a song writes it, such as `C-4` or `F#5`:
 * the opposite of `toNoteNumber`. Throws for a note below `C-0` (12) or
 * above `HIGHEST_NOTE`, which a song cannot write.
 */
export function toNoteName(note: number): string {
    if (!(Number.isInteger(note) && note >= 12 && note <= HIGHEST_NOTE)) throw new Error(`note ${note} has no name: songs write notes from C-0 (12) to ${HIGHEST_NOTE_NAME} (${HIGHEST_NOTE})`);
    return NAMES[note % 12] + String(Math.floor(note / 12) - 1);
}

/**
 * The natural log of the ratio between two notes a semitone apart. The ratio
 * of notes `n` semitones apart is `Math.exp(n * LN_SEMITONE)`.
 *
 * The chips never call `Math.pow`, or use `**`. In Node and in Chrome, those
 * call the C library of the system they run on, and its last digit can differ
 * from one system to the next. `Math.exp` and `Math.log` are V8's own, the
 * same everywhere. So a song renders the same samples on every system, and
 * a test that hashes them passes on all of them.
 */
export const LN_SEMITONE = Math.LN2 / 12;

/** The frequency, in Hz, of a note number, which may be fractional (a note bent by vibrato). */
export function toFrequency(note: number): number {
    return 440 * Math.exp((note - 69) * LN_SEMITONE);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NOTE_NAME = /^([A-G])([-#])(\d)$/;

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Each semitone's name and sign, from C, as `toNoteName` writes them. */
const NAMES: readonly string[] = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
