import { type Audio80, type Audio80Character, type Audio80PlayOptions, type Audio80Song, type Audio80Sound, createAudio80SoundIds, VOICE_COUNT } from '../audio80';
import { createWebChip } from './web-chip';
import { type Audio80PassedMessage, AUDIO80_PROCESSOR_NAME, type Audio80RunnerSettings } from './worklet';
import processorUrl from './worklet/audio80-processor?worker&url';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a browser's Audio80. */
export interface Audio80Options {
    /**
     * The audio context to play in. Without one, the chip makes its own,
     * and starts it at the page's first click, tap or key press, since a
     * browser lets sound start only after the visitor does something. With
     * one, starting it is the caller's job. Until it runs, the chip plays
     * nothing, as `ready` explains.
     */
    readonly context?: AudioContext;
    /**
     * Whether the chip holds its sound while the page is hidden, as `pause`
     * does, and plays on as it shows again, unless it was paused itself.
     * Defaults to true. A page whose sound should play on in the background,
     * such as a music player, turns it off.
     */
    readonly pauseWhenHidden?: boolean;
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Audio80Character;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio80 for a browser. Each play goes to an `AudioWorklet`,
 * which plays it on the sound card's clock. Its `ready` resolves once the
 * worklet is running. Its songs play on the worklet's own sequencer. Each
 * sound is sent the first time it is played, and each song once, after its
 * instruments.
 */
export function createAudio80(options: Audio80Options = {}): Audio80 {
    const sounds = createAudio80SoundIds({ onSound: (id, data) => web.send({ kind: 'sound', id, data }) });
    const settings: Audio80RunnerSettings = { character: options.character };
    const web = createWebChip<Audio80PassedMessage, Audio80Song, Audio80Sound, Audio80PlayOptions>({
        context: options.context,
        pauseWhenHidden: options.pauseWhenHidden ?? true,
        sounds,
        processorUrl,
        processorName: AUDIO80_PROCESSOR_NAME,
        // The chip is mono. The browser plays its one channel on both speakers
        channelCount: 1,
        voiceCount: VOICE_COUNT,
        settings,
        // Its sounds are defined first, under the page's ids
        prepareSong: (song) => ({ song, soundIds: song.instruments.map(sounds.soundId) }),
    });

    return web.chip;
}
