import {
    ECHO_SETTINGS,
    FILTER_SETTINGS,
    OP_NOTE_OFF,
    OP_RELEASE_ALL,
    OP_RESERVE_VOICES,
    OP_SET_ECHO,
    OP_SET_FILTER,
    OP_SET_MIX,
    OP_SET_VOICE,
    VOICE_COUNT,
    VOICE_SETTINGS,
} from '../audio80';
import { type HeldWriteSlots, isIndex } from './held-writes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The Audio80's writes worth keeping while it cannot play: each voice's
 * latest `noteOff`, the latest value of each voice, filter and echo
 * setting, the voices kept for music, the mix, and the latest `releaseAll`.
 */
export const AUDIO80_HELD_SLOTS: HeldWriteSlots = createSlots();

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Lays out the slots. It runs once, when the module loads. */
function createSlots(): HeldWriteSlots {
    /** Filters `a` and `b`. */
    const filterCount = 2;
    /** The music bus and the effects bus. */
    const mixBusCount = 2;
    const noteOffBase = 0;
    const voiceBase = noteOffBase + VOICE_COUNT;
    const filterBase = voiceBase + VOICE_COUNT * VOICE_SETTINGS.length;
    const echoBase = filterBase + filterCount * FILTER_SETTINGS.length;
    const reserveSlot = echoBase + ECHO_SETTINGS.length;
    const mixBase = reserveSlot + 1;
    const releaseAllSlot = mixBase + mixBusCount;
    return {
        slotCount: releaseAllSlot + 1,
        findSlot(op, a, b) {
            switch (op) {
                case OP_NOTE_OFF:
                    return isIndex(a, VOICE_COUNT) ? noteOffBase + a : -1;
                case OP_SET_VOICE:
                    return isIndex(a, VOICE_COUNT) && isIndex(b, VOICE_SETTINGS.length) ? voiceBase + a * VOICE_SETTINGS.length + b : -1;
                case OP_SET_FILTER:
                    return isIndex(a, filterCount) && isIndex(b, FILTER_SETTINGS.length) ? filterBase + a * FILTER_SETTINGS.length + b : -1;
                case OP_SET_ECHO:
                    return isIndex(a, ECHO_SETTINGS.length) ? echoBase + a : -1;
                case OP_RESERVE_VOICES:
                    return reserveSlot;
                case OP_SET_MIX:
                    return isIndex(a, mixBusCount) ? mixBase + a : -1;
                case OP_RELEASE_ALL:
                    return releaseAllSlot;
                default:
                    return -1;
            }
        },
    };
}
