import type { Audio80, Audio80WithControls, AudioControls } from '@mvtjs/audio';
import { toSliderGain } from './slider-gain';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The page's sound. It holds one audio context with two Audio80s on it, each
 * with its controls. One chip is for the entries the page runs. The entry
 * host advances its clock with each session, so it stops while the session
 * is paused. The other chip is for the page's own sounds, such as its menus'.
 * The page advances it every frame, so it can play over a paused game.
 *
 * `prepare` makes the audio context and loads the chips' code, the first
 * time it is called. A page that never calls it makes and loads neither.
 * Browsers start audio only in response to a gesture, such as a click, so a
 * page prepares its sound in its first gesture's handler. `prepare` makes
 * the context before it waits for anything, so the context is made inside
 * the gesture, as Safari requires.
 *
 * A context made before any gesture, as when a link opens an entry, starts
 * on the next key press, click or touch. A context that stops later, as when
 * a phone takes a call, starts again in the same way.
 *
 * Each chip and its controls stay the same objects for the page's life.
 * Until the chips load, nothing stands behind these objects. Writes are
 * dropped, the clock stays at 0, and the controls only keep the volumes they
 * are given. Once the chips load, each takes the volumes kept, and every
 * call passes on to it.
 */
export interface PageSound {
    /** The chip that entries play on. It is silent until it loads, and always silent when sound is not enabled. */
    readonly entryAudio80: Audio80;
    /**
     * The controls of `entryAudio80`. They advance its clock, send its writes,
     * reset it and set the listener's volumes. Their `ready` is resolved
     * until the chips load, and then follows the loaded chip's.
     */
    readonly entryControls: AudioControls;
    /** The page's own chip, for sounds that belong to no session, such as a menu's. It is silent until it loads. */
    readonly pageAudio80: Audio80;
    /** The controls of `pageAudio80`. The page advances and flushes them every frame. */
    readonly pageControls: AudioControls;
    /** The listener's settings. Both chips take them, at once or when they load. */
    settings: SoundSettings;
    /**
     * Loads the chips the first time it is called, and returns the same
     * promise after that. If the chips' code fails to download, the next
     * call tries again. The promise never rejects. Where audio cannot start,
     * the chips stay silent. When sound is not enabled, it does nothing.
     */
    prepare: () => Promise<void>;
    /** Destroys both chips and closes the audio context. */
    destroy: () => void;
}

/** The listener's sound settings. The music and the sound effects each have their own volume, and 0 turns one off. */
export interface SoundSettings {
    /**
     * The music's volume, as a slider's position from 0 to 1. At 1, the
     * music plays as written. Below that, equal steps of the slider sound
     * like equal steps in loudness.
     */
    readonly musicVolume: number;
    /** The sound effects' volume, from 0 to 1, as for `musicVolume`. */
    readonly effectsVolume: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make the page's sound. */
export interface PageSoundOptions {
    /**
     * Whether the sound plays. When false, both chips stay silent and nothing
     * is loaded, as for the live previews on the Arcade's cards.
     */
    readonly isEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the page's sound, with both chips silent until `prepare` loads them. */
export function createPageSound(options: PageSoundOptions): PageSound {
    const entrySlot = createChipSlot();
    const pageSlot = createChipSlot();
    let context: AudioContext | undefined;
    let loading: Promise<void> | undefined;
    let settings: SoundSettings = DEFAULT_SETTINGS;
    // True when sound is not enabled, audio cannot start or the sound is destroyed. Then `prepare` does nothing
    let isOff = !options.isEnabled;
    applySettings();

    return {
        entryAudio80: entrySlot.audio80,
        entryControls: entrySlot.controls,
        pageAudio80: pageSlot.audio80,
        pageControls: pageSlot.controls,
        get settings() {
            return settings;
        },
        set settings(value) {
            settings = value;
            applySettings();
        },

        prepare() {
            if (isOff) return NOTHING_TO_LOAD;
            // The context is made before anything is awaited, so it is made inside the gesture that called this
            if (context === undefined) createContext();
            if (context === undefined) return NOTHING_TO_LOAD;
            loading ??= load(context);
            return loading;
        },

        destroy() {
            isOff = true;
            listenForGestures(false);
            entrySlot.controls.destroy();
            pageSlot.controls.destroy();
            void context?.close();
        },
    };

    /**
     * Makes the audio context, and listens for gestures if it has not started.
     * Where audio cannot start, it turns the sound off and warns, and makes
     * no context.
     */
    function createContext(): void {
        try {
            // Where the worklet cannot run, no context is made and the chips stay silent
            if (typeof AudioWorkletNode === 'undefined') throw new Error('Only a secure page has AudioWorklet.');
            context = new AudioContext({ latencyHint: 'interactive' });
        }
        catch (error) {
            warnSoundOff(error);
        }
        if (context === undefined) {
            isOff = true;
            return;
        }
        context.addEventListener('statechange', followState);
        followState();
    }

    async function load(made: AudioContext): Promise<void> {
        try {
            const { createWebAudio80 } = await import('@mvtjs/audio/web');
            // The sound was destroyed while the code loaded, so there is nothing to make
            if (isOff) return;
            const loaded = createWebAudio80({ context: made });
            loaded.controls.ready.catch(warnSoundOff);
            entrySlot.fill(loaded);
            pageSlot.fill(createWebAudio80({ context: made }));
        }
        catch (error) {
            // The code may have failed to download for a moment, so the next `prepare` tries again
            loading = undefined;
            warnSoundOff(error);
        }
    }

    /** Gives the chips the listener's settings. Each slider's position becomes a gain, so its steps sound even. */
    function applySettings(): void {
        const musicGain = toSliderGain(settings.musicVolume);
        const effectsGain = toSliderGain(settings.effectsVolume);
        entrySlot.controls.musicVolume = musicGain;
        entrySlot.controls.effectsVolume = effectsGain;
        pageSlot.controls.musicVolume = musicGain;
        pageSlot.controls.effectsVolume = effectsGain;
    }

    /**
     * Listens for gestures whenever the context is not running. A running
     * context can stop later, as when a phone takes a call.
     */
    function followState(): void {
        const state = context?.state ?? 'closed';
        listenForGestures(state !== 'running' && state !== 'closed');
    }

    function listenForGestures(isListening: boolean): void {
        const method = isListening ? 'addEventListener' : 'removeEventListener';
        for (const kind of GESTURES) window[method](kind, resume, true);
    }

    function resume(): void {
        context?.resume().catch(() => {
            // The browser did not accept this gesture. The next one may start the context
        });
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The events in whose handlers every browser lets a page start audio. On a
 * touch screen, a touch counts only when it ends, and a drag makes no click,
 * so `touchend` is listened for as well as `click`.
 */
const GESTURES = ['keydown', 'click', 'touchend'] as const;

/** The settings used until the page sets its own, with both sliders half way. */
const DEFAULT_SETTINGS: SoundSettings = {
    musicVolume: 0.5,
    effectsVolume: 0.5,
};

/** Every Audio80 has eight voices. */
const VOICE_COUNT = 8;

/**
 * A chip and controls that stand in for a chip still to come. Until `fill`
 * gives it one, writes are dropped and the controls only keep the volumes
 * set. After that, every call passes on to that chip, which takes the
 * volumes kept. The calls are bound once here, so passing one on makes no
 * garbage.
 */
interface ChipSlot extends Audio80WithControls {
    /** Puts `chip` behind the slot, with the volumes set so far. */
    fill: (chip: Audio80WithControls) => void;
}

function createChipSlot(): ChipSlot {
    let chip: Audio80WithControls | undefined;
    // The volumes as set, kept for the chip to come
    let volume = 1;
    let isMuted = false;
    let musicVolume = 1;
    let effectsVolume = 1;

    const audio80: Audio80 = {
        get time() {
            return chip === undefined ? 0 : chip.audio80.time;
        },
        voiceCount: VOICE_COUNT,
        play: (effect) => chip?.audio80.play(effect),
        noteOn: (voice, instrument, note, noteVolume, atMs) => chip?.audio80.noteOn(voice, instrument, note, noteVolume, atMs),
        noteOff: (voice, atMs) => chip?.audio80.noteOff(voice, atMs),
        setVoice: (voice, setting, value, atMs) => chip?.audio80.setVoice(voice, setting, value, atMs),
        setFilter: (filter, setting, value, atMs) => chip?.audio80.setFilter(filter, setting, value, atMs),
        setEcho: (setting, value, atMs) => chip?.audio80.setEcho(setting, value, atMs),
        reserveVoices: (count, atMs) => chip?.audio80.reserveVoices(count, atMs),
        releaseAll: () => chip?.audio80.releaseAll(),
    };
    const controls: AudioControls = {
        get ready() {
            return chip === undefined ? NOTHING_TO_LOAD : chip.controls.ready;
        },
        update: (deltaMs) => chip?.controls.update(deltaMs),
        flush: () => chip?.controls.flush(),
        reset: () => chip?.controls.reset(),
        get volume() {
            return chip === undefined ? volume : chip.controls.volume;
        },
        set volume(value) {
            volume = value;
            if (chip !== undefined) chip.controls.volume = value;
        },
        get isMuted() {
            return chip === undefined ? isMuted : chip.controls.isMuted;
        },
        set isMuted(value) {
            isMuted = value;
            if (chip !== undefined) chip.controls.isMuted = value;
        },
        get musicVolume() {
            return chip === undefined ? musicVolume : chip.controls.musicVolume;
        },
        set musicVolume(value) {
            musicVolume = value;
            if (chip !== undefined) chip.controls.musicVolume = value;
        },
        get effectsVolume() {
            return chip === undefined ? effectsVolume : chip.controls.effectsVolume;
        },
        set effectsVolume(value) {
            effectsVolume = value;
            if (chip !== undefined) chip.controls.effectsVolume = value;
        },
        destroy: () => chip?.controls.destroy(),
    };
    return {
        audio80,
        controls,
        fill(next) {
            chip = next;
            next.controls.volume = volume;
            next.controls.isMuted = isMuted;
            next.controls.musicVolume = musicVolume;
            next.controls.effectsVolume = effectsVolume;
        },
    };
}

/** Warns that sound is off, because audio could not start. */
function warnSoundOff(error: unknown): void {
    console.warn('Sound is off: audio could not start.', error);
}

/** The slot's `ready` while it has no chip. It is already resolved, since there is nothing to wait for. */
const NOTHING_TO_LOAD = Promise.resolve();
