import { type Audio90, type Audio90PlayOptions, type Audio90Song, type Audio90Sound, createAudio90SongDriver } from '../audio90';
import { createSongPlayer } from '../shared';
import { createHeadlessChip, createSilentWriter, type HeadlessChip } from './headless-chip';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * An Audio90 with no speaker, which makes no sound, as the headless Audio80
 * is. It takes every call as a chip with a speaker does, and its song moves
 * on with its clock, which the code that owns it moves on with `update`.
 */
export interface HeadlessAudio90 extends Audio90, HeadlessChip<Audio90Song, Audio90Sound, Audio90PlayOptions> {}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a headless Audio90, with its clock at 0 and nothing played. */
export function createHeadlessAudio90(): HeadlessAudio90 {
    const writer = createSilentWriter<Audio90Sound, Audio90PlayOptions>();
    return createHeadlessChip({ writer, player: createSongPlayer(createAudio90SongDriver(writer)) });
}
