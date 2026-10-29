import {
    type Audio90,
    type Audio90Character,
    type Audio90PlayOptions,
    type Audio90Song,
    type Audio90Sound,
    AUDIO90_VOICE_COUNT,
    createAudio90SoundIds,
} from '../audio90';
import { clampVolume, joinMembers, type SongCallbacks } from '../shared';
import { createWebChip } from './web-chip';
import { type Audio90PassedMessage, AUDIO90_PROCESSOR_NAME, type Audio90RunnerSettings } from './worklet';
import processorUrl from './worklet/audio90-processor?worker&url';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a browser's Audio90. */
export interface Audio90Options extends SongCallbacks<Audio90Song> {
    /**
     * The audio context to play in. Without one, the chip makes its own,
     * and starts it at the page's first click, tap or key press, since a
     * browser lets sound start only after the visitor does something. With
     * one, starting it is the caller's job. Until it runs, the chip plays
     * nothing, as `ready` explains. The context may hold
     * other chips too, such as an Audio80.
     */
    readonly context?: AudioContext;
    /**
     * Whether the chip holds its sound while the page is hidden, as `pause`
     * does, and plays on as it shows again, unless it was paused itself.
     * Defaults to true. A page whose sound should play on in the background,
     * such as a music player, turns it off.
     */
    readonly pauseWhenHidden?: boolean;
    /** How the chip sounds until a song sets it. Defaults to `'studio'`. */
    readonly character?: Audio90Character;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio90 for a browser. Each play goes to an `AudioWorklet`,
 * which plays it in stereo on the sound card's clock. Its `ready` resolves
 * once the worklet is running. The worklet's code is its own module, loaded
 * only when this is called.
 *
 * A sample is sent the first time a sound that plays it is played. It
 * is copied, not moved, so the page keeps it for the next session.
 *
 * Its songs play on the worklet's own sequencer, on the sound card's clock.
 * Each song is sent once, after its instruments and without their samples,
 * which the worklet already has by then.
 */
export function createAudio90(options: Audio90Options = {}): Audio90 {
    const sounds = createAudio90SoundIds({
        onSound: (id, data) => web.send({ kind: 'sound', id, data }),
        onSample: (id, data) => web.send({ kind: 'sample', id, data }),
    });
    const settings: Audio90RunnerSettings = { character: options.character };
    const web = createWebChip<Audio90PassedMessage, Audio90Song, Audio90Sound, Audio90PlayOptions>({
        context: options.context,
        pauseWhenHidden: options.pauseWhenHidden ?? true,
        sounds,
        processorUrl,
        callbacks: options,
        processorName: AUDIO90_PROCESSOR_NAME,
        channelCount: 2,
        voiceCount: AUDIO90_VOICE_COUNT,
        settings,
        // Its instruments are defined first, under the page's ids. The song travels without their samples,
        // which the worklet already has by then
        prepareSong(song) {
            const soundIds = song.instruments.map(sounds.soundId);
            const instruments = song.instruments.map((instrument) => (instrument.sample === undefined ? instrument : { ...instrument, sample: undefined }));
            return { song: { ...song, instruments }, soundIds };
        },
    });

    let stereoWidth = 1;
    return joinMembers(web.chip, {
        get stereoWidth() {
            return stereoWidth;
        },
        set stereoWidth(value: number) {
            // A width is clamped to 0 to 1, as a volume is
            stereoWidth = clampVolume(value);
            web.send({ kind: 'stereo-width', width: stereoWidth });
        },
    });
}
