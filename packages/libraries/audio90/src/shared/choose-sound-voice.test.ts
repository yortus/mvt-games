import { describe, expect, it } from 'vitest';
import { chooseSoundVoice, type SoundVoices } from './choose-sound-voice';

describe('choosing a voice for a sound', () => {
    it('takes the highest free voice', () => {
        const voices = toSoundVoices([MUSIC, FREE, FREE, MUSIC]);
        expect(chooseSoundVoice(voices, 0, ZAP, 0, 1)).toBe(2);
    });

    it('never takes a voice kept for music, even a free one', () => {
        const voices = toSoundVoices([FREE, FREE, MUSIC, MUSIC]);
        expect(chooseSoundVoice(voices, 2, ZAP, 0, 1)).toBe(3);
    });

    it('restarts the sound\'s oldest voice when it already plays on its maximum', () => {
        const voices = toSoundVoices([FREE, createPlayingVoice(ZAP, 0, 5), createPlayingVoice(ZAP, 0, 3), FREE]);
        expect(chooseSoundVoice(voices, 0, ZAP, 0, 2)).toBe(2);
        // Below its maximum, it takes a free voice instead
        expect(chooseSoundVoice(voices, 0, ZAP, 0, 3)).toBe(3);
    });

    it('with no voice free, takes the oldest of equal or lower priority, or a leftover music note', () => {
        const voices = toSoundVoices([createPlayingVoice(BOOM, 2, 1), createPlayingVoice(ZAP, 0, 4), { ...MUSIC, startedAt: 3 }]);
        expect(chooseSoundVoice(voices, 0, BEEP, 0, 1)).toBe(2);
        expect(chooseSoundVoice(voices, 0, BEEP, 2, 1)).toBe(0);
    });

    it('returns -1 when every voice it may take plays a sound of higher priority', () => {
        const voices = toSoundVoices([MUSIC, createPlayingVoice(BOOM, 2, 1)]);
        expect(chooseSoundVoice(voices, 1, ZAP, 0, 1)).toBe(-1);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZAP = 1;
const BEEP = 2;
const BOOM = 3;

interface Voice {
    readonly isSounding: boolean;
    readonly soundId: number;
    readonly priority: number;
    readonly startedAt: number;
}

const FREE: Voice = { isSounding: false, soundId: -1, priority: 0, startedAt: 0 };
const MUSIC: Voice = { isSounding: true, soundId: -1, priority: 0, startedAt: 0 };

function createPlayingVoice(soundId: number, priority: number, startedAt: number): Voice {
    return { isSounding: true, soundId, priority, startedAt };
}

function toSoundVoices(voices: readonly Voice[]): SoundVoices {
    return {
        soundId: Int32Array.from(voices, (voice) => voice.soundId),
        soundPriority: Float64Array.from(voices, (voice) => voice.priority),
        startedAt: Float64Array.from(voices, (voice) => voice.startedAt),
        isSounding: (v) => voices[v].isSounding,
    };
}
