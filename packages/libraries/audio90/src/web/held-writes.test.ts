import { describe, expect, it } from 'vitest';
import { createCommandAudio80, createAudio80Sound, OP_NOTE_OFF, OP_SET_FILTER, OP_STOP } from '../audio80';
import {
    AUDIO90_EFFECT_INDEX,
    AUDIO90_EFFECT_SETTING_INDEX,
    createAudio90Sound,
    createCommandAudio90,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_TEMPO,
} from '../audio90';
import { COMMAND_STRIDE } from '../shared';
import { AUDIO80_HELD_SLOTS } from './audio80-held-slots';
import { AUDIO90_HELD_SLOTS } from './audio90-held-slots';
import { createHeldWrites, STOP_SLOT_COUNT } from './held-writes';

describe('held writes, for an Audio80', () => {
    it('keeps one command per setting, the one with the latest stamp, however many are written', () => {
        const writer = createCommandAudio80({ onSound: ignore });
        for (let i = 0; i < 1000; i++) writer.setFilter('a', 'cutoffHz', 100 + i, i);
        // Written last, but stamped earlier. The synthesiser would apply it first, so it does not last
        writer.setFilter('a', 'cutoffHz', 50, 0);
        const held = createHeldWrites(AUDIO80_HELD_SLOTS);
        held.keep(writer.commands, writer.count);
        expect(held.count).toBe(1);
        const taken = held.take();
        expect([taken[0], taken[4]]).toEqual([OP_SET_FILTER, 1099]);
        expect(held.count).toBe(0);
    });

    it('drops notes and plays, and keeps each voice\'s latest noteOff and each play\'s stop', () => {
        const writer = createCommandAudio80({ onSound: ignore });
        const sound = createAudio80Sound({ wave: 'saw' });
        writer.noteOn(0, sound, 57, 1);
        writer.noteOff(0);
        writer.noteOn(1, sound, 60, 1);
        writer.noteOff(1);
        writer.noteOff(1, 5);
        writer.stop(writer.play(sound, { lengthMs: Infinity }));
        const held = createHeldWrites(AUDIO80_HELD_SLOTS);
        held.keep(writer.commands, writer.count);
        const taken = held.take();
        const ops: number[] = [];
        for (let at = 0; at < taken.length; at += COMMAND_STRIDE) ops.push(taken[at]);
        expect(ops).toEqual([OP_NOTE_OFF, OP_NOTE_OFF, OP_STOP]);
    });

    it('keeps the stops of the last plays apart, so each still stops', () => {
        const writer = createCommandAudio80({ onSound: ignore });
        const sound = createAudio80Sound({ wave: 'saw' });
        const ids: number[] = [];
        for (let i = 0; i < 40; i++) ids.push(writer.play(sound));
        writer.clear(writer.commands);
        const last = ids.slice(-STOP_SLOT_COUNT);
        for (const id of last) writer.stop(id);
        const held = createHeldWrites(AUDIO80_HELD_SLOTS);
        held.keep(writer.commands, writer.count);
        const taken = held.take();
        const stopped: number[] = [];
        for (let at = 0; at < taken.length; at += COMMAND_STRIDE) stopped.push(taken[at + 2]);
        expect(stopped.sort((a, b) => a - b)).toEqual(last);
    });
});

describe('held writes, for an Audio90', () => {
    it('keeps the latest value of each effect setting apart, and the character and the tempo', () => {
        const writer = createCommandAudio90({ onSound: ignore, onSample: ignore });
        writer.setEffect('reverb', 'level', 0.2);
        writer.setEffect('reverb', 'level', 0.4);
        writer.setEffect('echo', 'level', 0.6);
        writer.setEffect('pump', 'depth', 0.5);
        writer.setCharacter('console');
        writer.setCharacter('sampler');
        writer.setTempo(120);
        writer.setTempo(136);
        const held = createHeldWrites(AUDIO90_HELD_SLOTS);
        held.keep(writer.commands, writer.count);
        const commands = listCommands(held.take());
        const effects = commands.filter((command) => command[0] === OP90_SET_EFFECT).map((command) => [command[2], command[3], command[4]]);
        expect(effects).toEqual([
            [AUDIO90_EFFECT_INDEX.reverb, AUDIO90_EFFECT_SETTING_INDEX.reverb.level, 0.4],
            [AUDIO90_EFFECT_INDEX.echo, AUDIO90_EFFECT_SETTING_INDEX.echo.level, 0.6],
            [AUDIO90_EFFECT_INDEX.pump, AUDIO90_EFFECT_SETTING_INDEX.pump.depth, 0.5],
        ]);
        expect(commands.filter((command) => command[0] === OP90_SET_CHARACTER).map((command) => command[2])).toEqual([2]);
        expect(commands.filter((command) => command[0] === OP90_SET_TEMPO).map((command) => command[2])).toEqual([136]);
    });

    it('drops notes and plays, as for an Audio80', () => {
        const writer = createCommandAudio90({ onSound: ignore, onSample: ignore });
        const sound = createAudio90Sound({});
        writer.noteOn(0, sound, 60, 1);
        writer.play(sound);
        const held = createHeldWrites(AUDIO90_HELD_SLOTS);
        held.keep(writer.commands, writer.count);
        expect(held.count).toBe(0);
    });
});

function listCommands(commands: Float64Array): number[][] {
    const list: number[][] = [];
    for (let at = 0; at < commands.length; at += COMMAND_STRIDE) list.push(Array.from(commands.subarray(at, at + COMMAND_STRIDE)));
    return list;
}

function ignore(): void {
    // No worklet to send to
}
