import { describe, expect, it } from 'vitest';
import { DEFAULT_SOUND_SETTINGS, formatSoundSettings, parseSoundSettings } from './sound-settings';

describe('sound settings', () => {
    it('gives the defaults when nothing is saved, or what is saved is not settings', () => {
        expect(parseSoundSettings(undefined)).toEqual(DEFAULT_SOUND_SETTINGS);
        expect(parseSoundSettings('')).toEqual(DEFAULT_SOUND_SETTINGS);
        expect(parseSoundSettings('{not json')).toEqual(DEFAULT_SOUND_SETTINGS);
        expect(parseSoundSettings('42')).toEqual(DEFAULT_SOUND_SETTINGS);
        expect(parseSoundSettings('null')).toEqual(DEFAULT_SOUND_SETTINGS);
    });

    it('reads back what it saved', () => {
        const settings = { musicVolume: 0, effectsVolume: 0.9, musicVolumeBeforeOff: 0.2, effectsVolumeBeforeOff: undefined, isMuted: true };
        expect(parseSoundSettings(formatSoundSettings(settings))).toEqual(settings);
    });

    it('takes the default for each setting missing, of the wrong type, or out of range', () => {
        const parsed = parseSoundSettings(JSON.stringify({
            musicVolume: 1.5,
            effectsVolume: 0,
            musicVolumeBeforeOff: 0,
            effectsVolumeBeforeOff: '0.4',
            isMuted: 'yes',
        }));
        expect(parsed).toEqual({ ...DEFAULT_SOUND_SETTINGS, effectsVolume: 0 });
    });

    it('drops the level a volume had before it was turned off, if the volume is not off', () => {
        const parsed = parseSoundSettings(JSON.stringify({ ...DEFAULT_SOUND_SETTINGS, musicVolumeBeforeOff: 0.3, effectsVolumeBeforeOff: 0.7 }));
        expect(parsed).toEqual(DEFAULT_SOUND_SETTINGS);
    });
});
