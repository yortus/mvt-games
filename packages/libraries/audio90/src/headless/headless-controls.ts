import { type AudioControls, clampVolume, type CommandWriter, MAX_MIX_VOLUME, MIX_BUS_INDEX } from '../shared';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a rendering headless chip's controls drive: its writer, and the synthesiser that renders it. */
export interface RenderedControlsOptions {
    readonly writer: CommandWriter;
    readonly synthesiser: {
        readonly reset: () => void;
        readonly setMix: (bus: number, gain: number) => void;
    };
    /** Called once the writer's clock has advanced, to move the chip's songs on. */
    readonly onUpdate: (deltaMs: number) => void;
    /** Called as the chip resets, before its writes are cleared, to stop the chip's songs. */
    readonly onReset: () => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Creates the controls of a chip that does not render. `update` moves its
 * clock on, and its songs, and `reset` stops its songs. Its volumes are kept
 * as set, and clamped as every chip clamps them. The rest of the controls do
 * nothing.
 */
export function createSilentControls(options: { readonly update: (deltaMs: number) => void; readonly reset: () => void }): AudioControls {
    const { update, reset } = options;
    let volume = 1;
    let isMuted = false;
    let musicVolume = 1;
    let effectsVolume = 1;
    return {
        ready: Promise.resolve(),
        // It has no sound card, so it never stalls
        stallCount: 0,
        update,
        flush: ignore,
        reset,
        get volume() {
            return volume;
        },
        set volume(value) {
            volume = clampVolume(value, 1);
        },
        get isMuted() {
            return isMuted;
        },
        set isMuted(value) {
            isMuted = value;
        },
        get musicVolume() {
            return musicVolume;
        },
        set musicVolume(value) {
            musicVolume = clampVolume(value, MAX_MIX_VOLUME);
        },
        get effectsVolume() {
            return effectsVolume;
        },
        set effectsVolume(value) {
            effectsVolume = clampVolume(value, MAX_MIX_VOLUME);
        },
        destroy: ignore,
    };
}

/**
 * Creates the controls of a chip that renders in memory. `update` moves the
 * writer's clock on, and the mix is written as a command, as the browser's
 * chip writes it. The chip's `render` applies the volume and the mute
 * itself, reading them from these controls. `flush` does nothing, since
 * `render` takes the writes itself.
 */
export function createRenderedControls(options: RenderedControlsOptions): AudioControls {
    const { writer, synthesiser, onUpdate, onReset } = options;
    let volume = 1;
    let isMuted = false;
    let musicVolume = 1;
    let effectsVolume = 1;
    return {
        ready: Promise.resolve(),
        // It has no sound card, so it never stalls
        stallCount: 0,
        update(deltaMs) {
            writer.update(deltaMs);
            onUpdate(deltaMs);
        },
        flush: ignore,
        reset() {
            onReset();
            writer.clear(writer.commands);
            writer.forget();
            synthesiser.reset();
            // The synthesiser keeps its mix through a reset. But a mix change not yet rendered
            // was just cleared, so set the mix again
            synthesiser.setMix(MIX_BUS_INDEX.music, musicVolume);
            synthesiser.setMix(MIX_BUS_INDEX.effects, effectsVolume);
        },
        get volume() {
            return volume;
        },
        set volume(value) {
            volume = clampVolume(value, 1);
        },
        get isMuted() {
            return isMuted;
        },
        set isMuted(value) {
            isMuted = value;
        },
        get musicVolume() {
            return musicVolume;
        },
        set musicVolume(value) {
            musicVolume = clampVolume(value, MAX_MIX_VOLUME);
            writer.setMix('music', musicVolume);
        },
        get effectsVolume() {
            return effectsVolume;
        },
        set effectsVolume(value) {
            effectsVolume = clampVolume(value, MAX_MIX_VOLUME);
            writer.setMix('effects', effectsVolume);
        },
        destroy: ignore,
    };
}

/** Does nothing. A silent chip's writes are this function. */
export function ignore(): void {
    // Nothing to do
}
