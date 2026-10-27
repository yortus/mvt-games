import { type Audio80, type Audio90, AUDIO90_SCOPE_LENGTH, type AudioControls, type createAudio80, type createAudio90, type SongSlot } from 'audio90';
import type { SoundChipKind, SoundChipsByKind } from '../entry-types';
import { toSliderGain } from './slider-gain';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The page's sound. It holds one audio context, with the page's own Audio80
 * on it, and a chip of each kind for the entries the page runs. Each chip has
 * its controls, and keeps its time by the sound card. The entry host pauses
 * an entry chip as it pauses the session that plays on it. The page's own
 * chip plays on, for sounds such as its menus', so it can play over a paused
 * game. While the page is hidden, every chip is paused.
 *
 * `prepare` makes the audio context and loads the page's chip, the first
 * time it is called, and an entry chip the first time its kind is asked for.
 * A page that never calls it makes and loads nothing. A chip no entry asks
 * for is never loaded. Browsers start audio only in response to a gesture,
 * such as a click, so a page prepares its sound in its first gesture's
 * handler. `prepare` makes the context before it waits for anything, so the
 * context is made inside the gesture, as Safari requires. A chip loaded later
 * needs no gesture of its own.
 *
 * A context made before any gesture, as when a link opens an entry, starts
 * on the next key press, click or touch. A context that stops later, as when
 * a phone takes a call, starts again in the same way.
 *
 * Each chip and its controls stay the same objects for the page's life.
 * Until the chips load, nothing stands behind these objects. Writes are
 * dropped, the time stays at 0, and the controls only keep the volumes and
 * the pause they are given. Once the chips load, each takes what was kept,
 * and every call passes on to it.
 */
export interface PageSound {
    /**
     * The chips that entries play on, one of each kind. Each is silent until
     * it loads, and always silent when sound is not enabled.
     */
    readonly entryChips: EntryChips;
    /** The page's own chip, for sounds that belong to no session, such as a menu's. It is silent until it loads. */
    readonly pageAudio80: Audio80;
    /** The controls of `pageAudio80`. */
    readonly pageControls: AudioControls;
    /** The listener's settings. Every chip takes them, at once or when it loads. */
    settings: SoundSettings;
    /** Whether every chip is muted, the page's own and every entry chip, at once or when it loads. */
    isMuted: boolean;
    /**
     * Whether the page is hidden. While it is, every chip is paused, so no
     * music plays on behind a game that has stopped with the page's frames.
     * As the page shows again, each chip plays on, except one whose own
     * controls were paused, such as a paused game's.
     */
    isHidden: boolean;
    /**
     * Loads the page's chip the first time it is called. With `kind`, it also
     * loads the entry chip of that kind, the first time that kind is asked
     * for. It returns a promise that settles once both are ready, and never
     * rejects. If the chips' code fails to download, the next call tries
     * again. Where audio cannot start, the chips stay silent. When sound is
     * not enabled, it does nothing.
     */
    prepare: (kind?: SoundChipKind) => Promise<void>;
    /** Destroys every chip and closes the audio context. */
    destroy: () => void;
}

/** The chip of each kind that entries play on. */
export type EntryChips = { readonly [K in SoundChipKind]: EntryChip<K> };

/** A chip that entries play on, and its controls. */
export interface EntryChip<K extends SoundChipKind> {
    /** The chip, given to each session that plays on it. */
    readonly chip: SoundChipsByKind[K];
    /**
     * Its controls. They pause it, reset it and set the listener's volumes.
     * Their `ready` is resolved until the chip loads, and then follows the
     * loaded chip's. Their `isPaused` is the pause they were given, which
     * holds whether or not the page is hidden.
     */
    readonly controls: AudioControls;
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
     * Whether the sound plays. When false, every chip stays silent and nothing
     * is loaded, as for the live previews on the Arcade's cards.
     */
    readonly isEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the page's sound, with every chip silent until `prepare` loads it. */
export function createPageSound(options: PageSoundOptions): PageSound {
    const entrySlots: { readonly [K in SoundChipKind]: ChipSlot<SoundChipsByKind[K]> } = { audio80: createAudio80Slot(), audio90: createAudio90Slot() };
    const entryChips: EntryChips = {
        audio80: { chip: entrySlots.audio80.chip, controls: entrySlots.audio80.controls },
        audio90: { chip: entrySlots.audio90.chip, controls: entrySlots.audio90.controls },
    };
    const pageSlot = createAudio80Slot();
    // Every chip's slot and controls, for what is done to them all
    const allSlots: readonly Pick<ChipSlot<unknown>, 'controls' | 'setHidden'>[] = [pageSlot, ...Object.values(entrySlots)];
    const allControls: readonly AudioControls[] = allSlots.map((slot) => slot.controls);
    let isHidden = false;
    let context: AudioContext | undefined;
    // The chips' code, once it has loaded
    let makers: ChipMakers | undefined;
    // The page's chip loading, and each entry chip's
    let loading: Promise<void> | undefined;
    const entryLoading: { [K in SoundChipKind]?: Promise<void> } = {};
    let settings: SoundSettings = DEFAULT_SETTINGS;
    // True when sound is not enabled, audio cannot start or the sound is destroyed. Then `prepare` does nothing
    let isOff = !options.isEnabled;
    applySettings();

    return {
        entryChips,
        pageAudio80: pageSlot.chip,
        pageControls: pageSlot.controls,
        get settings() {
            return settings;
        },
        set settings(value) {
            settings = value;
            applySettings();
        },
        get isMuted() {
            return pageSlot.controls.isMuted;
        },
        set isMuted(value) {
            for (const controls of allControls) controls.isMuted = value;
        },
        get isHidden() {
            return isHidden;
        },
        set isHidden(value) {
            isHidden = value;
            for (const slot of allSlots) slot.setHidden(value);
        },

        prepare(kind) {
            if (isOff) return NOTHING_TO_LOAD;
            // The context is made before anything is awaited, so it is made inside the gesture that called this
            if (context === undefined) createContext();
            if (context === undefined) return NOTHING_TO_LOAD;
            const made = context;
            loading ??= load(made);
            if (kind === undefined) return loading;
            entryLoading[kind] ??= loading.then(() => loadEntryChip(kind, made));
            return entryLoading[kind];
        },

        destroy() {
            isOff = true;
            listenForGestures(false);
            for (const controls of allControls) controls.destroy();
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
            if (typeof AudioWorkletNode === 'undefined') {
                throw new Error(window.isSecureContext ? 'This browser has no AudioWorklet.' : 'Only a secure page, served over HTTPS, has AudioWorklet.');
            }
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

    /** Loads the chips' code, and makes the page's chip. */
    async function load(made: AudioContext): Promise<void> {
        try {
            const { createAudio80, createAudio90 } = await import('./web-chips');
            // The sound was destroyed while the code loaded, so there is nothing to make
            if (isOff) return;
            makers = { createAudio80, createAudio90 };
            const page = createAudio80({ context: made });
            page.controls.ready.catch(warnSoundOff);
            pageSlot.fill(page.audio80, page.controls);
        }
        catch (error) {
            // The code may have failed to download for a moment, so the next `prepare` tries again
            loading = undefined;
            warnSoundOff(error);
        }
    }

    /** Makes the entry chip of `kind`, once the chips' code has loaded. */
    function loadEntryChip(kind: SoundChipKind, made: AudioContext): void {
        if (makers === undefined || isOff) {
            // The code did not load, so the next `prepare` for this kind tries again
            entryLoading[kind] = undefined;
            return;
        }
        switch (kind) {
            case 'audio80': {
                const chip = makers.createAudio80({ context: made });
                entrySlots.audio80.fill(chip.audio80, chip.controls);
                break;
            }
            case 'audio90': {
                // Its worklet's code is a module of its own, which loads now, the first time an entry asks for it
                const chip = makers.createAudio90({ context: made });
                entrySlots.audio90.fill(chip.audio90, chip.controls);
                break;
            }
        }
    }

    /** Gives every chip the listener's settings. Each slider's position becomes a gain, so its steps sound even. */
    function applySettings(): void {
        const musicGain = toSliderGain(settings.musicVolume);
        const effectsGain = toSliderGain(settings.effectsVolume);
        for (const controls of allControls) {
            controls.musicVolume = musicGain;
            controls.effectsVolume = effectsGain;
        }
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

/** The chips' factories, once their code has loaded. */
interface ChipMakers {
    readonly createAudio80: typeof createAudio80;
    readonly createAudio90: typeof createAudio90;
}

/** Every Audio80 has eight voices. */
const AUDIO80_VOICE_COUNT = 8;
/** Every Audio90 has sixteen voices. */
const AUDIO90_VOICE_COUNT = 16;
/**
 * The id a stand-in chip gives a play it drops, as it drops every play until
 * its chip loads. A chip numbers its plays from 1, so `stop` with this id
 * stops nothing.
 */
const NO_PLAY = 0;

/**
 * A chip and controls that stand in for a chip still to come. Until `fill`
 * gives it one, writes and plays are dropped and the controls only keep the
 * volumes and the pause set. After that, every call passes on to that chip, which
 * takes what was kept. The calls are bound once, so passing one on makes no
 * garbage.
 */
interface ChipSlot<C> {
    /** The chip that stands in. */
    readonly chip: C;
    /** The controls that stand in. */
    readonly controls: AudioControls;
    /** Puts `chip` and its `controls` behind the slot, with the volumes and the pause set so far. */
    fill: (chip: C, controls: AudioControls) => void;
    /** Pauses the chip while the page is hidden, whatever its controls' own pause, and lets it play on as it shows. */
    setHidden: (isHidden: boolean) => void;
}

function createAudio80Slot(): ChipSlot<Audio80> {
    let filled: Audio80 | undefined;
    const slot = createControlsSlot();
    const chip: Audio80 = {
        get time() {
            return filled === undefined ? 0 : filled.time;
        },
        voiceCount: AUDIO80_VOICE_COUNT,
        play: (sound, options) => filled?.play(sound, options) ?? NO_PLAY,
        stop: (id) => filled?.stop(id),
        setVoice: (voice, setting, value, atMs) => filled?.setVoice(voice, setting, value, atMs),
        setFilter: (filter, setting, value, atMs) => filled?.setFilter(filter, setting, value, atMs),
        setEcho: (setting, value, atMs) => filled?.setEcho(setting, value, atMs),
        reserveVoices: (count, atMs) => filled?.reserveVoices(count, atMs),
        releaseAll: () => filled?.releaseAll(),
        openSongSlot: () => createDeferredSongSlot(() => filled),
    };
    return {
        chip,
        controls: slot.controls,
        fill(next, controls) {
            filled = next;
            slot.fill(controls);
        },
        setHidden: slot.setHidden,
    };
}

function createAudio90Slot(): ChipSlot<Audio90> {
    let filled: Audio90 | undefined;
    const slot = createControlsSlot();
    // What the scopes read until the chip loads: silence
    const silentScope = new Float32Array(AUDIO90_SCOPE_LENGTH);
    let isScoping = false;
    const chip: Audio90 = {
        get time() {
            return filled === undefined ? 0 : filled.time;
        },
        get heardTime() {
            return filled === undefined ? 0 : filled.heardTime;
        },
        voiceCount: AUDIO90_VOICE_COUNT,
        play: (sound, options) => filled?.play(sound, options) ?? NO_PLAY,
        stop: (id) => filled?.stop(id),
        setVoice: (voice, setting, value, atMs) => filled?.setVoice(voice, setting, value, atMs),
        setEffect: (effect, setting, value, atMs) => filled?.setEffect(effect, setting, value, atMs),
        setCharacter: (character, atMs) => filled?.setCharacter(character, atMs),
        setTempo: (bpm, atMs) => filled?.setTempo(bpm, atMs),
        reserveVoices: (count, atMs) => filled?.reserveVoices(count, atMs),
        releaseAll: () => filled?.releaseAll(),
        get scope() {
            return filled === undefined ? silentScope : filled.scope;
        },
        openSongSlot: () => createDeferredSongSlot(() => filled),
        setScopes(isOn) {
            // Kept, so a chip still to load turns them on as it is filled
            isScoping = isOn;
            filled?.setScopes(isOn);
        },
    };
    return {
        chip,
        controls: slot.controls,
        fill(next, controls) {
            filled = next;
            slot.fill(controls);
            if (isScoping) next.setScopes(true);
        },
        setHidden: slot.setHidden,
    };
}

/**
 * A slot on the sequencer of a chip still to come. It opens the chip's own
 * slot the first time it is used once the chip has loaded. Until then, as
 * the chip slots drop writes, it drops each call, and reports no song.
 */
function createDeferredSongSlot<S>(chip: () => { readonly openSongSlot: () => SongSlot<S> } | undefined): SongSlot<S> {
    let inner: SongSlot<S> | undefined;
    return {
        get song() {
            return open()?.song;
        },
        get orderIndex() {
            return open()?.orderIndex ?? 0;
        },
        get row() {
            return open()?.row ?? 0;
        },
        get beat() {
            return open()?.beat ?? 0;
        },
        play: (song) => open()?.play(song),
        queue: (song) => open()?.queue(song),
        stop: () => open()?.stop(),
        setTempoScale: (scale) => open()?.setTempoScale(scale),
    };

    function open(): SongSlot<S> | undefined {
        inner ??= chip()?.openSongSlot();
        return inner;
    }
}

/**
 * Controls that stand in for a chip's controls still to come, as a
 * `ChipSlot`'s do. The chip is paused while its controls are, or while the
 * page is hidden.
 */
function createControlsSlot(): { readonly controls: AudioControls; readonly fill: (controls: AudioControls) => void; readonly setHidden: (isHidden: boolean) => void } {
    let filled: AudioControls | undefined;
    // The volumes and the pause as set, kept for the chip to come
    let volume = 1;
    let isMuted = false;
    let musicVolume = 1;
    let effectsVolume = 1;
    let isPaused = false;
    let isHidden = false;

    const controls: AudioControls = {
        get ready() {
            return filled === undefined ? NOTHING_TO_LOAD : filled.ready;
        },
        get isPaused() {
            return isPaused;
        },
        pause() {
            isPaused = true;
            applyPause();
        },
        resume() {
            isPaused = false;
            applyPause();
        },
        reset: () => filled?.reset(),
        get volume() {
            return filled === undefined ? volume : filled.volume;
        },
        set volume(value) {
            volume = value;
            if (filled !== undefined) filled.volume = value;
        },
        get isMuted() {
            return filled === undefined ? isMuted : filled.isMuted;
        },
        set isMuted(value) {
            isMuted = value;
            if (filled !== undefined) filled.isMuted = value;
        },
        get musicVolume() {
            return filled === undefined ? musicVolume : filled.musicVolume;
        },
        set musicVolume(value) {
            musicVolume = value;
            if (filled !== undefined) filled.musicVolume = value;
        },
        get effectsVolume() {
            return filled === undefined ? effectsVolume : filled.effectsVolume;
        },
        set effectsVolume(value) {
            effectsVolume = value;
            if (filled !== undefined) filled.effectsVolume = value;
        },
        destroy: () => filled?.destroy(),
    };
    return {
        controls,
        fill(next) {
            filled = next;
            next.volume = volume;
            next.isMuted = isMuted;
            next.musicVolume = musicVolume;
            next.effectsVolume = effectsVolume;
            applyPause();
        },
        setHidden(value) {
            isHidden = value;
            applyPause();
        },
    };

    /** Pauses the chip while its controls are paused or the page is hidden, and lets it play on otherwise. */
    function applyPause(): void {
        if (isPaused || isHidden) filled?.pause();
        else filled?.resume();
    }
}

/** Warns that sound is off, because audio could not start. */
function warnSoundOff(error: unknown): void {
    console.warn('Sound is off: audio could not start.', error);
}

/** The slot's `ready` while it has no chip. It is already resolved, since there is nothing to wait for. */
const NOTHING_TO_LOAD = Promise.resolve();
