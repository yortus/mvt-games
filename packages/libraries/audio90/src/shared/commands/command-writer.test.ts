import { describe, expect, it } from 'vitest';
import { COMMAND_STRIDE, OP_PLAY, OP_PLAY_OPTIONS, OP_RELEASE_ALL, OP_STOP } from './commands';
import { type AnyPlayOptions, HELD_LENGTH, NO_GLIDE, type PlayDefaults } from './play-options';
import { createCommandWriter } from './command-writer';

describe('createCommandWriter', () => {
    it('plays a sound at once, as its options say, or as the sound says without them', () => {
        const writer = createCommandWriter<TestSound, AnyPlayOptions>({ soundIds: { soundId: () => SOUND_ID, forget: ignore } });
        const sound: TestSound = { data: { note: 64, glideTo: Number.NaN, lengthMs: 100 } };
        const first = writer.play(sound);
        const second = writer.play(sound, { note: 'C-4', lengthMs: Infinity, volume: 0.5, pan: 0.75, glideTo: 72 });
        writer.stop(second);
        writer.update(50);
        writer.releaseAll();
        expect(listCommands(writer)).toEqual([
            [OP_PLAY_OPTIONS, -Infinity, 100, NO_GLIDE, 0, 0],
            [OP_PLAY, -Infinity, SOUND_ID, first, 64, 1],
            [OP_PLAY_OPTIONS, -Infinity, HELD_LENGTH, 72, 0.75, 1],
            [OP_PLAY, -Infinity, SOUND_ID, second, 60, 0.5],
            [OP_STOP, -Infinity, second, 0, 0, 0],
            // Every call from the page applies as soon as it can, in the order made, as in a browser
            [OP_RELEASE_ALL, -Infinity, 0, 0, 0, 0],
        ]);
        expect([first, second, writer.takePlayId()]).toEqual([1, 2, 3]);
    });

    it('throws on a play\'s option out of range, and writes nothing for it', () => {
        const writer = createCommandWriter<TestSound, AnyPlayOptions>({ soundIds: { soundId: () => SOUND_ID, forget: ignore } });
        const sound: TestSound = { data: { note: 64, glideTo: Number.NaN, lengthMs: 100 } };
        expect(() => writer.play(sound, { lengthMs: 0 })).toThrow('play: lengthMs must be above 0');
        expect(() => writer.play(sound, { volume: -1 })).toThrow('play: volume must be 0 or more');
        expect(() => writer.play(sound, { note: 200 })).toThrow('play: note: 200 is not a note');
        expect(writer.count).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A sound, as the writer needs one: only its data's note, glide and length. */
interface TestSound {
    readonly data: PlayDefaults;
}

const SOUND_ID = 5;

function listCommands(writer: { readonly commands: Float64Array; readonly count: number }): number[][] {
    const commands: number[][] = [];
    for (let i = 0; i < writer.count; i++) commands.push(Array.from(writer.commands.subarray(i * COMMAND_STRIDE, (i + 1) * COMMAND_STRIDE)));
    return commands;
}

function ignore(): void {
    // Nothing to forget
}
