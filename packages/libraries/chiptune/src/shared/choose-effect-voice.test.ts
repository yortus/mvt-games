import { describe, expect, it } from 'vitest';
import { chooseEffectVoice, type EffectVoices } from './choose-effect-voice';

describe('effect voice allocator', () => {
    it('takes the highest free voice', () => {
        const voices = toEffectVoices([MUSIC, FREE, FREE, MUSIC]);
        expect(chooseEffectVoice(voices, 0, ZAP, 0, 1)).toBe(2);
    });

    it('never takes a voice kept for music, even a free one', () => {
        const voices = toEffectVoices([FREE, FREE, MUSIC, MUSIC]);
        expect(chooseEffectVoice(voices, 2, ZAP, 0, 1)).toBe(3);
    });

    it('restarts the effect\'s oldest voice when it already plays on its maximum', () => {
        const voices = toEffectVoices([FREE, createPlayingVoice(ZAP, 0, 5), createPlayingVoice(ZAP, 0, 3), FREE]);
        expect(chooseEffectVoice(voices, 0, ZAP, 0, 2)).toBe(2);
        // Below its maximum, it takes a free voice instead
        expect(chooseEffectVoice(voices, 0, ZAP, 0, 3)).toBe(3);
    });

    it('with no voice free, takes the oldest of equal or lower priority, or a leftover music note', () => {
        const voices = toEffectVoices([createPlayingVoice(BOOM, 2, 1), createPlayingVoice(ZAP, 0, 4), { ...MUSIC, startedAt: 3 }]);
        expect(chooseEffectVoice(voices, 0, BEEP, 0, 1)).toBe(2);
        expect(chooseEffectVoice(voices, 0, BEEP, 2, 1)).toBe(0);
    });

    it('returns -1 when every voice it may take plays an effect of higher priority', () => {
        const voices = toEffectVoices([MUSIC, createPlayingVoice(BOOM, 2, 1)]);
        expect(chooseEffectVoice(voices, 1, ZAP, 0, 1)).toBe(-1);
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
    readonly effectId: number;
    readonly priority: number;
    readonly startedAt: number;
}

const FREE: Voice = { isSounding: false, effectId: -1, priority: 0, startedAt: 0 };
const MUSIC: Voice = { isSounding: true, effectId: -1, priority: 0, startedAt: 0 };

function createPlayingVoice(effectId: number, priority: number, startedAt: number): Voice {
    return { isSounding: true, effectId, priority, startedAt };
}

function toEffectVoices(voices: readonly Voice[]): EffectVoices {
    return {
        effectId: Int32Array.from(voices, (voice) => voice.effectId),
        effectPriority: Float64Array.from(voices, (voice) => voice.priority),
        startedAt: Float64Array.from(voices, (voice) => voice.startedAt),
        isSounding: (v) => voices[v].isSounding,
    };
}
