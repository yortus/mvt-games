import { COMMAND_STRIDE } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The writes worth keeping while a chip cannot play, to send once it can. A
 * chip cannot play before its worklet runs, while its audio context is
 * suspended, or while it is paused.
 *
 * A page writes only plays and stops: a song's settings are written in the
 * worklet, by the chip's own sequencer. It keeps each `stop` of a play, up to
 * `STOP_SLOT_COUNT` of them, and the latest stop of every voice. Then a note
 * that started before the chip stopped playing still stops.
 *
 * It drops plays. Sent late, they would all play at once.
 *
 * It holds at most one command a slot, so it never grows. Which writes those
 * are is each chip's: a chip's `HeldWriteSlots` gives each write worth keeping
 * a slot of its own.
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

/**
 * Where a chip's held writes go. Each write worth keeping has a slot, and a
 * later write to the same slot replaces it.
 */
export interface HeldWriteSlots {
    /** How many slots there are. */
    readonly slotCount: number;
    /**
     * The slot of a command, from its opcode and its first two operands.
     * Returns -1 for a command not worth keeping, or one out of range, which
     * the synthesiser would ignore.
     */
    readonly findSlot: (op: number, a: number, b: number) => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates held writes that hold nothing yet, in a chip's slots. */
export function createHeldWrites(options: HeldWriteSlots): HeldWrites {
    const { slotCount, findSlot } = options;
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
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * How many plays' stops are kept while a chip cannot play. Each play has a
 * slot from its id, so the stops of the last this many plays never share
 * one. A stop of an older play may take the slot of a newer one, but a
 * pause rarely stops more than a few.
 */
export const STOP_SLOT_COUNT = 32;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Lays out the slots of a chip's held writes: one for the latest release of
 * every voice, and `STOP_SLOT_COUNT` for the stops of plays. `stopOp` and
 * `releaseAllOp` are the chip's opcodes for them.
 */
export function createStopSlots(options: { readonly stopOp: number; readonly releaseAllOp: number }): HeldWriteSlots {
    const { stopOp, releaseAllOp } = options;
    const releaseAllSlot = 0;
    const stopBase = 1;
    return {
        slotCount: stopBase + STOP_SLOT_COUNT,
        findSlot(op, a) {
            if (op === releaseAllOp) return releaseAllSlot;
            if (op === stopOp) return Number.isInteger(a) && a > 0 ? stopBase + a % STOP_SLOT_COUNT : -1;
            return -1;
        },
    };
}
