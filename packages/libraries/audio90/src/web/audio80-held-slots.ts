import {
    ECHO_SETTINGS,
    FILTER_SETTINGS,
    OP_NOTE_OFF,
    OP_RELEASE_ALL,
    OP_SET_ECHO,
    OP_SET_FILTER,
    OP_SET_VOICE,
    OP_STOP,
    VOICE_COUNT,
    VOICE_SETTINGS,
} from '../audio80';
import { type HeldWriteSlots, isIndex, STOP_SLOT_COUNT } from './held-writes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The Audio80's writes worth keeping while it cannot play: each voice's
 * latest `noteOff`, the latest `stop` of each recent play, the latest value
 * of each voice, filter and echo setting, and the latest `releaseAll`.
 */
export const AUDIO80_HELD_SLOTS: HeldWriteSlots = createSlots();

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Lays out the slots. It runs once, when the module loads. */
function createSlots(): HeldWriteSlots {
    /** Filters `a` and `b`. */
    const filterCount = 2;
    const noteOffBase = 0;
    const voiceBase = noteOffBase + VOICE_COUNT;
    const filterBase = voiceBase + VOICE_COUNT * VOICE_SETTINGS.length;
    const echoBase = filterBase + filterCount * FILTER_SETTINGS.length;
    const releaseAllSlot = echoBase + ECHO_SETTINGS.length;
    const stopBase = releaseAllSlot + 1;
    return {
        slotCount: stopBase + STOP_SLOT_COUNT,
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
                case OP_RELEASE_ALL:
                    return releaseAllSlot;
                case OP_STOP:
                    return Number.isInteger(a) && a > 0 ? stopBase + a % STOP_SLOT_COUNT : -1;
                default:
                    return -1;
            }
        },
    };
}
