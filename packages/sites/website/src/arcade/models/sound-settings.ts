// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The sound settings the Arcade keeps. They hold the volumes the host plays
 * at, and whether all sound is muted. For each volume, they also hold the
 * level it had when it was turned off, so that turning it on again restores
 * that level.
 */
export interface ArcadeSoundSettings {
    /** The music's volume, from 0 to 1. 0 is off. */
    readonly musicVolume: number;
    /** The effects' volume, from 0 to 1. 0 is off. */
    readonly effectsVolume: number;
    /** The music's volume as it was turned off. It is undefined unless the music was turned off and not moved since. */
    readonly musicVolumeBeforeOff: number | undefined;
    /** The effects' volume as they were turned off, as for `musicVolumeBeforeOff`. */
    readonly effectsVolumeBeforeOff: number | undefined;
    /** Whether all sound is muted. Muting leaves the volumes as they are, so unmuting brings each back. */
    readonly isMuted: boolean;
}

/** The settings a first visit starts with. The music and the effects are each at half volume, and nothing is muted. */
export const DEFAULT_SOUND_SETTINGS: ArcadeSoundSettings = {
    musicVolume: 0.5,
    effectsVolume: 0.5,
    musicVolumeBeforeOff: undefined,
    effectsVolumeBeforeOff: undefined,
    isMuted: false,
};

/**
 * The settings a first visit on a phone or a tablet starts with. They are the
 * defaults, muted. A phone is often used in public, where a page that makes
 * sound unasked can embarrass its owner. Unmuting plays each sound at its
 * default volume.
 */
export const HANDHELD_SOUND_SETTINGS: ArcadeSoundSettings = {
    ...DEFAULT_SOUND_SETTINGS,
    isMuted: true,
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Reads settings that `formatSoundSettings` wrote. A setting that is missing,
 * of the wrong type or out of range takes its default. Text that is not
 * settings at all, such as nothing saved, gives the defaults. A level a
 * volume had before it was turned off is dropped if the volume is not off.
 */
export function parseSoundSettings(text: string | undefined): ArcadeSoundSettings {
    let saved: unknown;
    try {
        saved = text === undefined ? undefined : JSON.parse(text);
    }
    catch {
        saved = undefined;
    }
    const fields = typeof saved === 'object' && saved !== null ? saved as Record<string, unknown> : {};
    const musicVolume = parseVolume(fields.musicVolume, DEFAULT_SOUND_SETTINGS.musicVolume);
    const effectsVolume = parseVolume(fields.effectsVolume, DEFAULT_SOUND_SETTINGS.effectsVolume);
    return {
        musicVolume,
        effectsVolume,
        musicVolumeBeforeOff: musicVolume > 0 ? undefined : parseLevel(fields.musicVolumeBeforeOff),
        effectsVolumeBeforeOff: effectsVolume > 0 ? undefined : parseLevel(fields.effectsVolumeBeforeOff),
        isMuted: fields.isMuted === true,
    };
}

/** Returns `settings` as text that `parseSoundSettings` reads back. */
export function formatSoundSettings(settings: ArcadeSoundSettings): string {
    return JSON.stringify(settings);
}

/** Clamps `volume` to the range 0 to 1. NaN becomes 0. */
export function clampVolume(volume: number): number {
    return Number.isNaN(volume) ? 0 : Math.max(0, Math.min(1, volume));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns `value` if it is a level a sound can be turned on again at, above 0 and at most 1. Otherwise returns undefined. */
function parseLevel(value: unknown): number | undefined {
    return typeof value === 'number' && value > 0 && value <= 1 ? value : undefined;
}

/** Returns `value` if it is a volume from 0 to 1. Otherwise returns `otherwise`. */
function parseVolume(value: unknown, otherwise: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : otherwise;
}
