import { type Audio80, type Audio80Character, type Audio80PlayOptions, type Audio80Song, type Audio80Sound, createCommandAudio80, OP_RELEASE_ALL, OP_STOP } from '../audio80';
import { createStopSlots } from './held-writes';
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
 * Creates an Audio80 for a browser. At the end of each task that writes to
 * the chip, the writes go to an `AudioWorklet`, which plays them on the sound
 * card's clock. Its `ready` resolves once the worklet is running. Its songs
 * play on the worklet's own sequencer. Each song is sent once, after its
 * instruments.
 */
export function createAudio80(options: Audio80Options = {}): Audio80 {
    const writer = createCommandAudio80({
        onSound: (id, data) => web.send({ kind: 'sound', id, data }),
        // The chip's time is the worklet's, so a write with no stamp plays as soon as it arrives
        hasClock: false,
        onFirstWrite: () => web.sendSoon(),
    });
    const settings: Audio80RunnerSettings = { character: options.character };
    const web = createWebChip<Audio80PassedMessage, Audio80Song, Audio80Sound, Audio80PlayOptions>({
        context: options.context,
        pauseWhenHidden: options.pauseWhenHidden ?? true,
        writer,
        heldSlots: createStopSlots({ stopOp: OP_STOP, releaseAllOp: OP_RELEASE_ALL }),
        processorUrl,
        processorName: AUDIO80_PROCESSOR_NAME,
        // The chip is mono. The browser plays its one channel on both speakers
        channelCount: 1,
        settings,
        // Its sounds are defined first, under the writer's ids
        prepareSong: (song) => ({ song, soundIds: song.instruments.map(writer.defineSound) }),
    });

    return web.chip;
}
