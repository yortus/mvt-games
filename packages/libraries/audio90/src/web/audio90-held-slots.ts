import {
    AUDIO90_EFFECT_INDEX,
    AUDIO90_EFFECT_SETTING_INDEX,
    AUDIO90_VOICE_COUNT,
    AUDIO90_VOICE_SETTING_INDEX,
    OP90_NOTE_OFF,
    OP90_RELEASE_ALL,
    OP90_RESERVE_VOICES,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_MIX,
    OP90_SET_TEMPO,
    OP90_SET_VOICE,
    OP90_STOP,
} from '../audio90';
import { type HeldWriteSlots, isIndex, STOP_SLOT_COUNT } from './held-writes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The Audio90's writes worth keeping while it cannot play: each voice's
 * latest `noteOff`, the latest `stop` of each recent play, the latest value
 * of each voice and effect setting, the character, the tempo, the voices
 * kept for music, the mix, and the latest `releaseAll`.
 */
export const AUDIO90_HELD_SLOTS: HeldWriteSlots = createSlots();

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Lays out the slots. It runs once, when the module loads. */
function createSlots(): HeldWriteSlots {
    /** The music bus and the effects bus. */
    const mixBusCount = 2;
    const voiceSettingCount = Object.keys(AUDIO90_VOICE_SETTING_INDEX).length;
    const effectCount = Object.keys(AUDIO90_EFFECT_INDEX).length;
    // Each effect has as many slots as the effect with the most settings, so an effect's slots start at a multiple of that
    let effectSettingCount = 0;
    for (const settings of Object.values(AUDIO90_EFFECT_SETTING_INDEX)) effectSettingCount = Math.max(effectSettingCount, Object.keys(settings).length);
    const noteOffBase = 0;
    const voiceBase = noteOffBase + AUDIO90_VOICE_COUNT;
    const effectBase = voiceBase + AUDIO90_VOICE_COUNT * voiceSettingCount;
    const characterSlot = effectBase + effectCount * effectSettingCount;
    const tempoSlot = characterSlot + 1;
    const reserveSlot = tempoSlot + 1;
    const mixBase = reserveSlot + 1;
    const releaseAllSlot = mixBase + mixBusCount;
    const stopBase = releaseAllSlot + 1;
    return {
        slotCount: stopBase + STOP_SLOT_COUNT,
        findSlot(op, a, b) {
            switch (op) {
                case OP90_NOTE_OFF:
                    return isIndex(a, AUDIO90_VOICE_COUNT) ? noteOffBase + a : -1;
                case OP90_SET_VOICE:
                    return isIndex(a, AUDIO90_VOICE_COUNT) && isIndex(b, voiceSettingCount) ? voiceBase + a * voiceSettingCount + b : -1;
                case OP90_SET_EFFECT:
                    return isIndex(a, effectCount) && isIndex(b, effectSettingCount) ? effectBase + a * effectSettingCount + b : -1;
                case OP90_SET_CHARACTER:
                    return characterSlot;
                case OP90_SET_TEMPO:
                    return tempoSlot;
                case OP90_RESERVE_VOICES:
                    return reserveSlot;
                case OP90_SET_MIX:
                    return isIndex(a, mixBusCount) ? mixBase + a : -1;
                case OP90_RELEASE_ALL:
                    return releaseAllSlot;
                case OP90_STOP:
                    return Number.isInteger(a) && a > 0 ? stopBase + a % STOP_SLOT_COUNT : -1;
                default:
                    return -1;
            }
        },
    };
}
