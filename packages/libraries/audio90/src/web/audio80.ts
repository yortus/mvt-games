import { type Audio80, type Audio80Character, type Audio80Song, type Audio80WithControls, createCommandAudio80 } from '../audio80';
import { AUDIO80_HELD_SLOTS } from './audio80-held-slots';
import { type Audio80PassedMessage, AUDIO80_PROCESSOR_NAME, type Audio80RunnerSettings } from './audio80-runner';
import { createWebChip } from './web-chip';
import processorUrl from './audio80-processor?worker&url';

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
     * nothing, as `AudioControls.ready` explains.
     */
    readonly context?: AudioContext;
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Audio80Character;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio80 for a browser, and its controls. At the end of each
 * task that writes to the chip, the writes go to an `AudioWorklet`, which
 * plays them on the sound card's clock. The controls' `ready` resolves once
 * the worklet is running. Its songs play on the worklet's own sequencer.
 * Each song is sent once, after its instruments.
 */
export function createAudio80(options: Audio80Options = {}): Audio80WithControls {
    const writer = createCommandAudio80({
        onSound: (id, data) => web.send({ kind: 'sound', id, data }),
        // The chip's time is the worklet's, so a write with no stamp plays as soon as it arrives
        hasClock: false,
        onFirstWrite: () => web.sendSoon(),
    });
    const settings: Audio80RunnerSettings = { character: options.character };
    const web = createWebChip<Audio80PassedMessage, Audio80Song>({
        context: options.context,
        writer,
        heldSlots: AUDIO80_HELD_SLOTS,
        processorUrl,
        processorName: AUDIO80_PROCESSOR_NAME,
        // The chip is mono. The browser plays its one channel on both speakers
        channelCount: 1,
        settings,
        // Its sounds are defined first, under the writer's ids
        prepareSong: (song) => ({ song, soundIds: song.instruments.map(writer.defineSound) }),
    });

    const audio80: Audio80 = {
        get time() {
            return web.time;
        },
        voiceCount: writer.voiceCount,
        play: writer.play,
        stop: writer.stop,
        setVoice: writer.setVoice,
        setFilter: writer.setFilter,
        setEcho: writer.setEcho,
        reserveVoices: writer.reserveVoices,
        releaseAll: writer.releaseAll,
        openSongSlot: web.openSongSlot,
    };

    return { audio80, controls: web.controls };
}
