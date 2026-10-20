import { type Audio90, type Audio90Character, AUDIO90_SCOPE_LENGTH, type Audio90WithControls, createCommandAudio90 } from '../audio90';
import { AUDIO90_HELD_SLOTS } from './audio90-held-slots';
import { type Audio90PassedMessage, AUDIO90_PROCESSOR_NAME, type Audio90RunnerSettings, type Audio90ScopeReply } from './audio90-runner';
import { createWebChip } from './web-chip';
import processorUrl from './audio90-processor?worker&url';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a browser's Audio90. */
export interface WebAudio90Options {
    /**
     * The audio context to play in. The caller must resume it after a user
     * gesture, such as a click. Until it runs, the chip plays nothing, as
     * `AudioControls.ready` explains. The context may hold other chips too,
     * such as an Audio80.
     */
    readonly context: AudioContext;
    /**
     * How far, in ms, the worklet plays behind the newest chip time it has
     * been sent. This leaves room for ticks that arrive late, so the music
     * plays on through a late frame. Defaults to 100.
     */
    readonly leadMs?: number;
    /** How the chip sounds until a song sets it. Defaults to `'studio'`. */
    readonly character?: Audio90Character;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Audio90 for a browser, and its controls. Once a tick,
 * `AudioControls.flush` sends the chip's writes to an `AudioWorklet`, which
 * plays them in stereo. The controls' `ready` resolves once the worklet is
 * running. The worklet's code is its own module, loaded only when this is
 * called.
 *
 * A sample is sent the first time an instrument that plays it is played. It
 * is copied, not moved, so the page keeps it for the next session.
 *
 * While scopes are on, the worklet sends one about 94 times a second, in one
 * of three buffers that go back and forth, so none is allocated as they do.
 * Each is copied into `scope` as it arrives.
 */
export function createWebAudio90(options: WebAudio90Options): Audio90WithControls {
    const writer = createCommandAudio90({
        onInstrument: (id, data) => web.send({ kind: 'instrument', id, data }),
        onEffect: (id, data) => web.send({ kind: 'effect', id, data }),
        onSample: (id, data) => web.send({ kind: 'sample', id, data }),
    });
    const settings: Audio90RunnerSettings = { leadMs: options.leadMs, character: options.character };
    const scope = new Float32Array(AUDIO90_SCOPE_LENGTH);
    let isScoping = false;
    const web = createWebChip<Audio90PassedMessage>({
        context: options.context,
        writer,
        heldSlots: AUDIO90_HELD_SLOTS,
        processorUrl,
        processorName: AUDIO90_PROCESSOR_NAME,
        channelCount: 2,
        settings,
        onReply(reply) {
            if (reply.kind !== 'scope') return;
            const { data } = reply as Audio90ScopeReply;
            // A scope sent before they were turned off is dropped, and so is its buffer
            if (!isScoping) return;
            scope.set(data);
            web.send({ kind: 'scope-buffer', data }, [data.buffer]);
        },
        // The worklet turns its scopes off as it resets
        onReset: () => turnScopesOff(),
    });

    const audio90: Audio90 = {
        get time() {
            return writer.time;
        },
        get heardTime() {
            return web.heardTime;
        },
        voiceCount: writer.voiceCount,
        play: writer.play,
        noteOn: writer.noteOn,
        noteOff: writer.noteOff,
        setVoice: writer.setVoice,
        setEffect: writer.setEffect,
        setCharacter: writer.setCharacter,
        setTempo: writer.setTempo,
        reserveVoices: writer.reserveVoices,
        releaseAll: writer.releaseAll,
        scope,
        setScopes(isOn) {
            if (isOn === isScoping) return;
            if (!isOn) {
                turnScopesOff();
                web.send({ kind: 'scopes', isOn: false });
                return;
            }
            isScoping = true;
            web.send({ kind: 'scopes', isOn: true });
            for (let i = 0; i < SCOPE_BUFFERS; i++) {
                const data = new Float32Array(AUDIO90_SCOPE_LENGTH);
                web.send({ kind: 'scope-buffer', data }, [data.buffer]);
            }
        },
    };

    return { audio90, controls: web.controls };

    function turnScopesOff(): void {
        isScoping = false;
        scope.fill(0);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many buffers go back and forth for scopes. With three, one is always on its way back while another fills. */
const SCOPE_BUFFERS = 3;
