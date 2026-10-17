import { COMMAND_STRIDE } from '../shared';

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
 * Which writes those are is each chip's: a chip's `HeldWriteSlots` gives
 * each write worth keeping a slot of its own.
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
// Functions
// ---------------------------------------------------------------------------

/** Whether `value` is a whole number from 0 to `length` - 1. Each chip's slots use it to check a command's operands. */
export function isIndex(value: number, length: number): boolean {
    return Number.isInteger(value) && value >= 0 && value < length;
}
