import { describe, expect, it } from 'vitest';
import { createAudio80Sound, createCommandAudio80, OP_RELEASE_ALL, OP_STOP } from '../audio80';
import { COMMAND_STRIDE } from '../shared';
import { createHeldWrites, createStopSlots, STOP_SLOT_COUNT } from './held-writes';

describe('held writes', () => {
    it('drops plays, and keeps each play\'s stop and the latest release of every voice', () => {
        const writer = createCommandAudio80({ onSound: ignore });
        const sound = createAudio80Sound({ wave: 'saw' });
        writer.stop(writer.play(sound, { lengthMs: Infinity }));
        writer.releaseAll();
        writer.releaseAll();
        const held = createHeldWrites(SLOTS);
        held.keep(writer.commands, writer.count);
        expect(listOps(held.take()).sort()).toEqual([OP_STOP, OP_RELEASE_ALL].sort());
        expect(held.count).toBe(0);
    });

    it('keeps the stops of the last plays apart, so each still stops', () => {
        const writer = createCommandAudio80({ onSound: ignore });
        const sound = createAudio80Sound({ wave: 'saw' });
        const ids: number[] = [];
        for (let i = 0; i < 40; i++) ids.push(writer.play(sound));
        writer.clear(writer.commands);
        const last = ids.slice(-STOP_SLOT_COUNT);
        for (const id of last) writer.stop(id);
        const held = createHeldWrites(SLOTS);
        held.keep(writer.commands, writer.count);
        const taken = held.take();
        const stopped: number[] = [];
        for (let at = 0; at < taken.length; at += COMMAND_STRIDE) stopped.push(taken[at + 2]);
        expect(stopped.sort((a, b) => a - b)).toEqual(last);
    });
});

/** The Audio80's slots, as its browser chip lays them out. */
const SLOTS = createStopSlots({ stopOp: OP_STOP, releaseAllOp: OP_RELEASE_ALL });

function listOps(commands: Float64Array): number[] {
    const ops: number[] = [];
    for (let at = 0; at < commands.length; at += COMMAND_STRIDE) ops.push(commands[at]);
    return ops;
}

function ignore(): void {
    // No worklet to send to
}
