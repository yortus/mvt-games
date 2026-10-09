import { describe, expect, it } from 'vitest';
import { createCommandAudio80 } from '../chip';
import { COMMAND_STRIDE, OP_NOTE_OFF, OP_SET_FILTER } from '../core';
import { createInstrument } from '../notation';
import { createHeldWrites } from './held-writes';

describe('held writes', () => {
    it('keeps one command per setting, the one with the latest stamp, however many are written', () => {
        const writer = createCommandAudio80({ onInstrument: ignore, onEffect: ignore });
        for (let i = 0; i < 1000; i++) writer.setFilter('a', 'cutoffHz', 100 + i, i);
        // Written last, but stamped earlier. The synthesiser would apply it first, so it does not last
        writer.setFilter('a', 'cutoffHz', 50, 0);
        const held = createHeldWrites();
        held.keep(writer.commands, writer.count);
        expect(held.count).toBe(1);
        const taken = held.take();
        expect([taken[0], taken[4]]).toEqual([OP_SET_FILTER, 1099]);
        expect(held.count).toBe(0);
    });

    it('drops notes and effects, and keeps each voice\'s latest noteOff', () => {
        const writer = createCommandAudio80({ onInstrument: ignore, onEffect: ignore });
        const instrument = createInstrument({ wave: 'saw' });
        writer.noteOn(0, instrument, 57, 1);
        writer.noteOff(0);
        writer.noteOn(1, instrument, 60, 1);
        writer.noteOff(1);
        writer.noteOff(1, 5);
        const held = createHeldWrites();
        held.keep(writer.commands, writer.count);
        const taken = held.take();
        const ops: number[] = [];
        for (let at = 0; at < taken.length; at += COMMAND_STRIDE) ops.push(taken[at]);
        expect(ops).toEqual([OP_NOTE_OFF, OP_NOTE_OFF]);
    });
});

function ignore(): void {
    // No worklet to send to
}
