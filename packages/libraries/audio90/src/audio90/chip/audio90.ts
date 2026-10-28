import type { SoundChip } from '../../shared';
import type { Audio90Song, Audio90Sound } from '../notation';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Audio90 is a sixteen-voice stereo sound chip in the spirit of the
 * synthesisers, samplers and game consoles of the 1990s. It plays songs, on
 * a sequencer of its own, and sounds, and can be paused and turned down, as
 * `SoundChip` describes. Every play starts as soon as it reaches the chip,
 * as on the Audio80.
 */
export type Audio90 = SoundChip<Audio90Song, Audio90Sound, Audio90PlayOptions>;

/** How one play of a sound differs from the sound's own settings. Each option defaults to the sound's. */
export interface Audio90PlayOptions {
    /** The note to play, as a name such as `'E-5'`, or a note number, where 60 is middle C. */
    readonly note?: string | number;
    /** A note to glide to over the play's length, as a name or a number. */
    readonly glideTo?: string | number;
    /** How long it holds its note before releasing it, in ms, above 0. `Infinity` holds it until `stop`. */
    readonly lengthMs?: number;
    /** A volume for this play, 0 or more, which scales the sound's own. Defaults to 1. */
    readonly volume?: number;
    /** Where it plays, from -1 (left) to 1 (right). */
    readonly pan?: number;
}
