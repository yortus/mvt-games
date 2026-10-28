import {
    type Audio90,
    type Audio90Character,
    type Audio90PlayOptions,
    AUDIO90_SCOPE_LENGTH,
    type Audio90Song,
    type Audio90Sound,
    createCommandAudio90,
    OP90_RELEASE_ALL,
    OP90_STOP,
} from '../audio90';
import { joinMembers } from '../shared';
import { createStopSlots } from './held-writes';
import { createWebChip } from './web-chip';
import { type Audio90PassedMessage, AUDIO90_PROCESSOR_NAME, type Audio90RunnerSettings, type Audio90ScopeReply } from './worklet';
import processorUrl from './worklet/audio90-processor?worker&url';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a browser's Audio90. */
export interface Audio90Options {
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
 * Creates an Audio90 for a browser. At the end of each task that writes to
 * the chip, the writes go to an `AudioWorklet`, which plays them in stereo
 * on the sound card's clock. Its `ready` resolves once the worklet is
 * running. The worklet's code is its own module, loaded only when this is
 * called.
 *
 * A sample is sent the first time a sound that plays it is played. It
 * is copied, not moved, so the page keeps it for the next session.
 *
 * While scopes are on, the worklet sends one about 94 times a second, in one
 * of three buffers that go back and forth, so none is allocated as they do.
 * Each is copied into `scope` as it arrives.
 *
 * Its songs play on the worklet's own sequencer, on the sound card's clock.
 * Each song is sent once, after its instruments and without their samples,
 * which the worklet already has by then.
 */
export function createAudio90(options: Audio90Options = {}): Audio90 {
    const writer = createCommandAudio90({
        onSound: (id, data) => web.send({ kind: 'sound', id, data }),
        onSample: (id, data) => web.send({ kind: 'sample', id, data }),
        // The chip's time is the worklet's, so a write with no stamp plays as soon as it arrives
        hasClock: false,
        onFirstWrite: () => web.sendSoon(),
    });
    const settings: Audio90RunnerSettings = { character: options.character };
    const scope = new Float32Array(AUDIO90_SCOPE_LENGTH);
    let isScoping = false;
    const web = createWebChip<Audio90PassedMessage, Audio90Song, Audio90Sound, Audio90PlayOptions>({
        context: options.context,
        pauseWhenHidden: options.pauseWhenHidden ?? true,
        writer,
        heldSlots: createStopSlots({ stopOp: OP90_STOP, releaseAllOp: OP90_RELEASE_ALL }),
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
        // The worklet turns its scopes off as it resets, so they are turned on again if they were on
        onReset() {
            if (isScoping) sendScopesOn();
        },
        // Its instruments are defined first, under the writer's ids. The song travels without their samples,
        // which the worklet already has by then
        prepareSong(song) {
            const soundIds = song.instruments.map(writer.defineSound);
            const instruments = song.instruments.map((instrument) => (instrument.sample === undefined ? instrument : { ...instrument, sample: undefined }));
            return { song: { ...song, instruments }, soundIds };
        },
    });

    return joinMembers(web.chip, {
        scope,
        setScopes(isOn: boolean) {
            if (isOn === isScoping) return;
            if (!isOn) {
                isScoping = false;
                scope.fill(0);
                web.send({ kind: 'scopes', isOn: false });
                return;
            }
            isScoping = true;
            sendScopesOn();
        },
    });

    /** Turns the worklet's scopes on, and hands it the buffers to send them in. */
    function sendScopesOn(): void {
        web.send({ kind: 'scopes', isOn: true });
        for (let i = 0; i < SCOPE_BUFFERS; i++) {
            const data = new Float32Array(AUDIO90_SCOPE_LENGTH);
            web.send({ kind: 'scope-buffer', data }, [data.buffer]);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many buffers go back and forth for scopes. With three, one is always on its way back while another fills. */
const SCOPE_BUFFERS = 3;
