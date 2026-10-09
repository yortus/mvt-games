import {
    COMMAND_STRIDE,
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
} from '../core';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The writes worth keeping while a chip cannot play, to send once it can. A
 * chip cannot play before its worklet runs, or while its audio context is
 * suspended.
 *
 * It keeps the latest value of each setting. A song sets most of its
 * settings once, when it starts, such as its filters and echo. If those were
 * lost, the song would sound wrong until it started again.
 *
 * It keeps the latest call to stop a note (`noteOff`) on each voice. Then a
 * note that started before the chip stopped playing still stops.
 *
 * It drops notes and sound effects. Sent late, they would all play at once.
 *
 * It holds at most one command per setting and voice, so it never grows.
 */
export interface HeldWrites {
    /** How many commands are held. */
    readonly count: number;
    /** Keeps what is worth keeping of the first `count` commands in `commands`. */
    keep: (commands: Float64Array, count: number) => void;
    /** Returns the held commands in a new buffer, `COMMAND_STRIDE` numbers each, and then holds none. The synthesiser sorts them by stamp. */
    take: () => Float64Array;
    /** Drops every held command. */
    clear: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates held writes that hold nothing yet. */
export function createHeldWrites(): HeldWrites {
    const voiceBase = NOTE_OFF_BASE + VOICE_COUNT;
    const filterBase = voiceBase + VOICE_COUNT * VOICE_SETTINGS.length;
    const echoBase = filterBase + FILTER_COUNT * FILTER_SETTINGS.length;
    const reserveSlot = echoBase + ECHO_SETTINGS.length;
    const mixBase = reserveSlot + 1;
    const releaseAllSlot = mixBase + MIX_BUS_COUNT;
    const slotCount = releaseAllSlot + 1;

    const slots = new Float64Array(slotCount * COMMAND_STRIDE);
    const isHeld = new Uint8Array(slotCount);
    let count = 0;

    return {
        get count() {
            return count;
        },

        keep(commands, commandCount) {
            for (let i = 0; i < commandCount; i++) {
                const from = i * COMMAND_STRIDE;
                const slot = findSlot(commands[from], commands[from + 2], commands[from + 3]);
                if (slot < 0) continue;
                const at = slot * COMMAND_STRIDE;
                // The synthesiser applies writes in stamp order, so the one with the latest stamp is the one that lasts
                if (isHeld[slot] === 1 && slots[at + 1] > commands[from + 1]) continue;
                if (isHeld[slot] === 0) count++;
                isHeld[slot] = 1;
                for (let n = 0; n < COMMAND_STRIDE; n++) slots[at + n] = commands[from + n];
            }
        },

        take() {
            const taken = new Float64Array(count * COMMAND_STRIDE);
            let to = 0;
            for (let slot = 0; slot < slotCount; slot++) {
                if (isHeld[slot] === 0) continue;
                taken.set(slots.subarray(slot * COMMAND_STRIDE, (slot + 1) * COMMAND_STRIDE), to);
                to += COMMAND_STRIDE;
            }
            isHeld.fill(0);
            count = 0;
            return taken;
        },

        clear() {
            isHeld.fill(0);
            count = 0;
        },
    };

    /** The slot a command is held in. Returns -1 for a command not worth keeping, or one out of range, which the synthesiser would ignore. */
    function findSlot(op: number, a: number, b: number): number {
        switch (op) {
            case OP_NOTE_OFF:
                return isIndex(a, VOICE_COUNT) ? NOTE_OFF_BASE + a : -1;
            case OP_SET_VOICE:
                return isIndex(a, VOICE_COUNT) && isIndex(b, VOICE_SETTINGS.length) ? voiceBase + a * VOICE_SETTINGS.length + b : -1;
            case OP_SET_FILTER:
                return isIndex(a, FILTER_COUNT) && isIndex(b, FILTER_SETTINGS.length) ? filterBase + a * FILTER_SETTINGS.length + b : -1;
            case OP_SET_ECHO:
                return isIndex(a, ECHO_SETTINGS.length) ? echoBase + a : -1;
            case OP_RESERVE_VOICES:
                return reserveSlot;
            case OP_SET_MIX:
                return isIndex(a, MIX_BUS_COUNT) ? mixBase + a : -1;
            case OP_RELEASE_ALL:
                return releaseAllSlot;
            default:
                return -1;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NOTE_OFF_BASE = 0;
/** Filters `a` and `b`. */
const FILTER_COUNT = 2;
/** The music bus and the effects bus. */
const MIX_BUS_COUNT = 2;

function isIndex(value: number, length: number): boolean {
    return Number.isInteger(value) && value >= 0 && value < length;
}
