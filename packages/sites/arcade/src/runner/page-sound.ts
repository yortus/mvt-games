import {
    type Audio80,
    type Audio80PlayOptions,
    type Audio80Song,
    type Audio80Sound,
    type Audio90,
    type Audio90PlayOptions,
    type Audio90Song,
    type Audio90Sound,
    type createAudio80,
    type createAudio90,
    type SoundChip,
} from 'audio90';
import { AUDIO90_SCOPE_LENGTH } from 'audio90/tracker';
import type { SessionChips, SoundChipKind, SoundChipsByKind } from '../entry-types';
import { toSliderGain } from './slider-gain';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The page's sound. It holds one audio context, with the page's own two
 * Audio80s on it, one for its sounds and one for its music, and two chips of
 * each kind for the entries the page runs: one for a session's music, and
 * one for its sound effects. The music chips play at the music's volume, and
 * the others at the sound effects' volume. Each chip keeps its time by the
 * sound card. The entry host pauses a session's chips as it pauses the
 * session. The page's own chips play on, for sounds such as its menus', so
 * they can play over a paused game. Every chip holds its sound while the page
 * is hidden.
 *
 * `prepare` makes the audio context and loads the page's chips, the first
 * time it is called, and an entry's chips the first time their kind is asked
 * for. A page that never calls it makes and loads nothing. A chip no entry
 * asks for is never loaded. Browsers start audio only in response to a gesture,
 * such as a click, so a page prepares its sound in its first gesture's
 * handler. `prepare` makes the context before it waits for anything, so the
 * context is made inside the gesture, as Safari requires. A chip loaded later
 * needs no gesture of its own.
 *
 * A context made before any gesture, as when a link opens an entry, starts
 * on the next key press, click or touch. A context that stops later, as when
 * a phone takes a call, starts again in the same way.
 *
 * Each chip stays the same object for the page's life. Until the chips load,
 * nothing stands behind these objects. Plays are dropped, and each chip only
 * keeps the volumes, the tempo scale and the pause it is given. Once the chips load, each takes what was kept, and
 * every call passes on to it.
 */
export interface PageSound {
    /**
     * The chips that entries play on: of each kind, one for the music and one
     * for the sound effects. Each is silent until it loads, and always silent
     * when sound is not enabled. Its `ready` is resolved until it loads, and
     * then follows the loaded chip's.
     */
    readonly entryChips: EntryChips;
    /** The page's own chip for sounds that belong to no session, such as a menu's. It is silent until it loads. */
    readonly pageSfx: Audio80;
    /** The page's own chip for music, such as the music slider's preview. It is silent until it loads. */
    readonly pageMusic: Audio80;
    /** The listener's settings. Every chip takes them, at once or when it loads. */
    settings: SoundSettings;
    /** Whether every chip is muted, the page's own and every entry chip, at once or when it loads. */
    isMuted: boolean;
    /**
     * Loads the page's chips the first time it is called. With `kind`, it
     * also loads the entry chips of that kind, the first time that kind is
     * asked for. It returns a promise that settles once they are ready, and never
     * rejects. If the chips' code fails to download, the next call tries
     * again. Where audio cannot start, the chips stay silent. When sound is
     * not enabled, it does nothing.
     */
    prepare: (kind?: SoundChipKind) => Promise<void>;
    /** Destroys every chip and closes the audio context. */
    destroy: () => void;
}

/** The chips of each kind that entries play on: one for a session's music, and one for its sound effects. */
export type EntryChips = { readonly [K in SoundChipKind]: SessionChips<K> };

/** The listener's sound settings. The music and the sound effects each have their own volume, and 0 turns one off. */
export interface SoundSettings {
    /**
     * The music's volume, as a slider's position from 0 to 1. At 1, the
     * music plays as written. Below that, equal steps of the slider sound
     * like equal steps in loudness.
     */
    readonly musicVolume: number;
    /** The sound effects' volume, from 0 to 1, as for `musicVolume`. */
    readonly sfxVolume: number;
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
    const entrySlots: { readonly [K in SoundChipKind]: SlotPair<SoundChipsByKind[K]> } = {
        audio80: { music: createAudio80Slot(), sfx: createAudio80Slot() },
        audio90: { music: createAudio90Slot(), sfx: createAudio90Slot() },
    };
    const entryChips: EntryChips = {
        audio80: { music: entrySlots.audio80.music.chip, sfx: entrySlots.audio80.sfx.chip },
        audio90: { music: entrySlots.audio90.music.chip, sfx: entrySlots.audio90.sfx.chip },
    };
    const pageSlots: SlotPair<Audio80> = { music: createAudio80Slot(), sfx: createAudio80Slot() };
    // The chips that play at the music's volume, and those that play at the sound effects', for the settings
    const musicChips: readonly AnyChip[] = [pageSlots.music.chip, entryChips.audio80.music, entryChips.audio90.music];
    const sfxChips: readonly AnyChip[] = [pageSlots.sfx.chip, entryChips.audio80.sfx, entryChips.audio90.sfx];
    const allChips: readonly AnyChip[] = [...musicChips, ...sfxChips];
    let context: AudioContext | undefined;
    // The chips' code, once it has loaded
    let makers: ChipMakers | undefined;
    // The page's chips loading, and each kind of entry chip's
    let loading: Promise<void> | undefined;
    const entryLoading: { [K in SoundChipKind]?: Promise<void> } = {};
    let settings: SoundSettings = DEFAULT_SETTINGS;
    // True when sound is not enabled, audio cannot start or the sound is destroyed. Then `prepare` does nothing
    let isOff = !options.isEnabled;
    applySettings();

    return {
        entryChips,
        pageSfx: pageSlots.sfx.chip,
        pageMusic: pageSlots.music.chip,
        get settings() {
            return settings;
        },
        set settings(value) {
            settings = value;
            applySettings();
        },
        get isMuted() {
            return pageSlots.sfx.chip.isMuted;
        },
        set isMuted(value) {
            for (const chip of allChips) chip.isMuted = value;
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
            for (const chip of allChips) chip.destroy();
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

    /** Loads the chips' code, and makes the page's chips. */
    async function load(made: AudioContext): Promise<void> {
        try {
            const { createAudio80, createAudio90 } = await import('./web-chips');
            // The sound was destroyed while the code loaded, so there is nothing to make
            if (isOff) return;
            makers = { createAudio80, createAudio90 };
            const sfx = createAudio80({ context: made });
            sfx.ready.catch(warnSoundOff);
            pageSlots.sfx.fill(sfx);
            pageSlots.music.fill(createAudio80({ context: made }));
        }
        catch (error) {
            // The code may have failed to download for a moment, so the next `prepare` tries again
            loading = undefined;
            warnSoundOff(error);
        }
    }

    /** Makes the entry chips of `kind`, once the chips' code has loaded. */
    function loadEntryChip(kind: SoundChipKind, made: AudioContext): void {
        if (makers === undefined || isOff) {
            // The code did not load, so the next `prepare` for this kind tries again
            entryLoading[kind] = undefined;
            return;
        }
        switch (kind) {
            case 'audio80':
                entrySlots.audio80.music.fill(makers.createAudio80({ context: made }));
                entrySlots.audio80.sfx.fill(makers.createAudio80({ context: made }));
                break;
            case 'audio90':
                // Its worklet's code is a module of its own, which loads now, the first time an entry asks for it
                entrySlots.audio90.music.fill(makers.createAudio90({ context: made }));
                entrySlots.audio90.sfx.fill(makers.createAudio90({ context: made }));
                break;
        }
    }

    /** Gives every chip its volume from the listener's settings. Each slider's position becomes a gain, so its steps sound even. */
    function applySettings(): void {
        const musicGain = toSliderGain(settings.musicVolume);
        const sfxGain = toSliderGain(settings.sfxVolume);
        for (const chip of musicChips) chip.volume = musicGain;
        for (const chip of sfxChips) chip.volume = sfxGain;
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
    sfxVolume: 0.5,
};

/** The chips' factories, once their code has loaded. */
interface ChipMakers {
    readonly createAudio80: typeof createAudio80;
    readonly createAudio90: typeof createAudio90;
}

/**
 * The id a stand-in chip gives a play it drops, as it drops every play until
 * its chip loads. A chip numbers its plays from 1, so `stop` with this id
 * stops nothing.
 */
const NO_PLAY = 0;

/** Either kind of chip, as the page's sound treats them all. */
type AnyChip = Audio80 | Audio90;

/**
 * A chip that stands in for a chip still to come. Until `fill` gives it one,
 * plays are dropped, and it only keeps the volume, the mute,
 * the tempo scale and the pause set. After that, every call passes on to that
 * chip, which takes what was kept. The calls are bound once, so passing one
 * on makes no garbage.
 */
interface ChipSlot<C extends AnyChip> {
    /** The chip that stands in. */
    readonly chip: C;
    /** Puts `chip` behind the slot, with the volume, the mute, the tempo scale and the pause set so far. */
    fill: (chip: C) => void;
}

/** Two slots of one kind: one for music and one for sound effects. */
interface SlotPair<C extends AnyChip> {
    readonly music: ChipSlot<C>;
    readonly sfx: ChipSlot<C>;
}

function createAudio80Slot(): ChipSlot<Audio80> {
    let filled: Audio80 | undefined;
    const shared = createSharedStandIn<Audio80Song, Audio80Sound, Audio80PlayOptions>(() => filled);
    return {
        chip: shared.chip,
        fill(next) {
            filled = next;
            shared.fill(next);
        },
    };
}

function createAudio90Slot(): ChipSlot<Audio90> {
    let filled: Audio90 | undefined;
    const shared = createSharedStandIn<Audio90Song, Audio90Sound, Audio90PlayOptions>(() => filled);
    // What the scopes read until the chip loads: silence
    const silentScope = new Float32Array(AUDIO90_SCOPE_LENGTH);
    let isScoping = false;
    const own: Omit<Audio90, keyof SoundChip<Audio90Song, Audio90Sound, Audio90PlayOptions>> = {
        get scope() {
            return filled === undefined ? silentScope : filled.scope;
        },
        setScopes(isOn) {
            // Kept, so a chip still to load turns them on as it is filled
            isScoping = isOn;
            filled?.setScopes(isOn);
        },
    };
    return {
        chip: addMembers(shared.chip, own),
        fill(next) {
            filled = next;
            shared.fill(next);
            if (isScoping) next.setScopes(true);
        },
    };
}

/** The members every chip has, standing in for the chip that `read` returns once it has loaded, as a `ChipSlot`'s chip does. */
function createSharedStandIn<Song, Sound, PlayOptions>(read: () => SoundChip<Song, Sound, PlayOptions> | undefined): {
    readonly chip: SoundChip<Song, Sound, PlayOptions>;
    readonly fill: (chip: SoundChip<Song, Sound, PlayOptions>) => void;
} {
    // The volume, the mute, the tempo scale and the pause as set, kept for the chip to come
    let volume = 1;
    let isMuted = false;
    let tempoScale = 1;
    let isPaused = false;

    const chip: SoundChip<Song, Sound, PlayOptions> = {
        get ready() {
            return read()?.ready ?? NOTHING_TO_LOAD;
        },
        play(target: Song | Sound, options?: PlayOptions) {
            // The chip's `play` takes a song or a sound. TypeScript can't pass the two on through its two
            // signatures, so it is called as the one function it is
            const play = read()?.play as ((target: Song | Sound, options?: PlayOptions) => number) | undefined;
            return play === undefined ? NO_PLAY : play(target, options);
        },
        queue: (song) => read()?.queue(song) ?? NO_PLAY,
        stop: (id) => read()?.stop(id),
        get song() {
            return read()?.song;
        },
        get orderIndex() {
            return read()?.orderIndex ?? 0;
        },
        get row() {
            return read()?.row ?? 0;
        },
        get beat() {
            return read()?.beat ?? 0;
        },
        get tempoScale() {
            return read()?.tempoScale ?? tempoScale;
        },
        set tempoScale(value) {
            tempoScale = value;
            const filled = read();
            if (filled !== undefined) filled.tempoScale = value;
        },
        get isPaused() {
            return isPaused;
        },
        pause() {
            isPaused = true;
            read()?.pause();
        },
        resume() {
            isPaused = false;
            read()?.resume();
        },
        get volume() {
            return read()?.volume ?? volume;
        },
        set volume(value) {
            volume = value;
            const filled = read();
            if (filled !== undefined) filled.volume = value;
        },
        get isMuted() {
            return read()?.isMuted ?? isMuted;
        },
        set isMuted(value) {
            isMuted = value;
            const filled = read();
            if (filled !== undefined) filled.isMuted = value;
        },
        destroy: () => read()?.destroy(),
    };
    return {
        chip,
        fill(next) {
            next.volume = volume;
            next.isMuted = isMuted;
            next.tempoScale = tempoScale;
            if (isPaused) next.pause();
        },
    };
}

/**
 * Copies the members of `extra` onto `base`, getters and setters as they
 * are, and returns `base`. A stand-in joins the members every chip has with
 * its own chip's this way, without reading a getter as it copies it.
 */
function addMembers<B extends object, E extends object>(base: B, extra: E): B & E {
    return Object.defineProperties(base, Object.getOwnPropertyDescriptors(extra)) as B & E;
}

/** Warns that sound is off, because audio could not start. */
function warnSoundOff(error: unknown): void {
    console.warn('Sound is off: audio could not start.', error);
}

/** The slot's `ready` while it has no chip. It is already resolved, since there is nothing to wait for. */
const NOTHING_TO_LOAD = Promise.resolve();
