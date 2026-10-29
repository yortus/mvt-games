import { type Audio90, type Audio90PlayOptions, type Audio90Song, type Audio90Sound, createAudio90SongDriver } from '../audio90';
import { clampVolume, joinMembers, type SongCallbacks } from '../shared';
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
// Options
// ---------------------------------------------------------------------------

/** How a headless Audio90 tells its owner of its songs: what it calls, during `update`, as they reach each row and end. */
export type HeadlessAudio90Options = SongCallbacks<Audio90Song>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a headless Audio90, with its clock at 0 and nothing played. */
export function createHeadlessAudio90(options: HeadlessAudio90Options = {}): HeadlessAudio90 {
    const writer = createSilentWriter<Audio90Sound, Audio90PlayOptions>();
    let stereoWidth = 1;
    return joinMembers(createHeadlessChip({ writer, driver: createAudio90SongDriver(writer), callbacks: options }), {
        get stereoWidth() {
            return stereoWidth;
        },
        set stereoWidth(value: number) {
            // A width is clamped to 0 to 1, as a volume is
            stereoWidth = clampVolume(value);
        },
    });
}
