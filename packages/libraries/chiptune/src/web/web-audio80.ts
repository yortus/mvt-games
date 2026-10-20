import { type Audio80, type Audio80Character, type Audio80WithControls, createCommandAudio80 } from '../audio80';
import { AUDIO80_HELD_SLOTS } from './audio80-held-slots';
import { type Audio80PassedMessage, AUDIO80_PROCESSOR_NAME, type Audio80RunnerSettings } from './audio80-runner';
import { createWebChip } from './web-chip';
import processorUrl from './audio80-processor?worker&url';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a browser's Audio80. */
export interface WebAudio80Options {
    /**
     * The audio context to play in. The caller must resume it after a user
     * gesture, such as a click. Until it runs, the chip plays nothing, as
     * `AudioControls.ready` explains.
     */
    readonly context: AudioContext;
    /**
     * How far, in ms, the worklet plays behind the newest chip time it has
     * been sent. This leaves room for ticks that arrive late, so the music
     * plays on through a late frame. Defaults to 100.
     */
    readonly leadMs?: number;
    /** How the chip sounds. Defaults to `'classic'`. */
    readonly character?: Audio80Character;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio80 for a browser, and its controls. Once a tick,
 * `AudioControls.flush` sends the chip's writes to an `AudioWorklet`, which
 * plays them. The controls' `ready` resolves once the worklet is running.
 */
export function createWebAudio80(options: WebAudio80Options): Audio80WithControls {
    const writer = createCommandAudio80({
        onInstrument: (id, data) => web.send({ kind: 'instrument', id, data }),
        onEffect: (id, data) => web.send({ kind: 'effect', id, data }),
    });
    const settings: Audio80RunnerSettings = { leadMs: options.leadMs, character: options.character };
    const web = createWebChip<Audio80PassedMessage>({
        context: options.context,
        writer,
        heldSlots: AUDIO80_HELD_SLOTS,
        processorUrl,
        processorName: AUDIO80_PROCESSOR_NAME,
        // The chip is mono. The browser plays its one channel on both speakers
        channelCount: 1,
        settings,
    });

    const audio80: Audio80 = {
        get time() {
            return writer.time;
        },
        voiceCount: writer.voiceCount,
        play: writer.play,
        noteOn: writer.noteOn,
        noteOff: writer.noteOff,
        setVoice: writer.setVoice,
        setFilter: writer.setFilter,
        setEcho: writer.setEcho,
        reserveVoices: writer.reserveVoices,
        releaseAll: writer.releaseAll,
    };

    return { audio80, controls: web.controls };
}
