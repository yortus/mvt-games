import { type Audio80, type Audio80PlayOptions, type Audio80Song, type Audio80Sound, createAudio80SongDriver } from '../audio80';
import type { SongCallbacks } from '../shared';
import { createHeadlessChip, createSilentWriter, type HeadlessChip } from './headless-chip';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio80 with no speaker, which makes no sound. A game run headless
 * plays on one, for example to make thumbnails or run benchmarks, and so
 * does a test of what a view plays. The code that owns it moves its clock
 * on with `update`.
 *
 * It takes every call as a chip with a speaker does. It checks a play's
 * options, and returns its id. Its clock runs, and its song moves on, so
 * code that reads where the song is behaves as usual. A test of what a view
 * plays spies on the chip's `play`, `queue` and `stop`, and reads its `song`
 * and `tempoScale`. To hear what a song or a sound sounds like, render it
 * with `render`.
 */
export interface HeadlessAudio80 extends Audio80, HeadlessChip<Audio80Song, Audio80Sound, Audio80PlayOptions> {}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How a headless Audio80 tells its owner of its songs: what it calls, during `update`, as they reach each row and end. */
export type HeadlessAudio80Options = SongCallbacks<Audio80Song>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a headless Audio80, with its clock at 0 and nothing played. */
export function createHeadlessAudio80(options: HeadlessAudio80Options = {}): HeadlessAudio80 {
    const writer = createSilentWriter<Audio80Sound, Audio80PlayOptions>();
    return createHeadlessChip({ writer, driver: createAudio80SongDriver(writer), callbacks: options });
}
