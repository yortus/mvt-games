import type { SoundChip } from '../../shared';
import type { Audio80Song, Audio80Sound } from '../notation';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Audio80 is a four-voice sound chip in the spirit of the sound chips in
 * 1980s home computers. It plays songs, on a sequencer of its own, and sounds,
 * and can be paused and turned down, as `SoundChip` describes. Every play
 * starts as soon as it reaches the chip.
 *
 * `play` takes its options as an object. The code that plays a sound calls
 * it only as something happens, such as a shot being fired, so making the
 * object costs nothing that matters.
 */
export type Audio80 = SoundChip<Audio80Song, Audio80Sound, Audio80PlayOptions>;

/** How one play of a sound differs from the sound's own settings. Each option defaults to the sound's. */
export interface Audio80PlayOptions {
    /** The note to play, as a name such as `'E-5'`, or a note number, where 60 is middle C. */
    readonly note?: string | number;
    /** A note to glide to over the play's length, as a name or a number. */
    readonly glideTo?: string | number;
    /** How long it holds its note before releasing it, in ms, above 0. `Infinity` holds it until `stop`. */
    readonly lengthMs?: number;
    /** A volume for this play, 0 or more, which scales the sound's own. Defaults to 1. */
    readonly volume?: number;
}
