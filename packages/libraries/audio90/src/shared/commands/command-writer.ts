import { type CommandBuffer, createCommandBuffer } from './command-buffer';
import { ASAP_STAMP, OP_RELEASE_ALL, OP_STOP } from './commands';
import { type AnyPlayOptions, checkPlay, type PlayDefaults, writePlay } from './play-options';
import type { SongWriter, SoundIds } from '../song-player';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A chip's writer, where its synthesiser runs: on a headless chip, in a
 * sample's bounce, and for the songs in a browser's worklet. It turns each
 * call into a command for the synthesiser, stamped with the time it applies
 * at, and appends it to a `Float64Array`, so writing allocates nothing.
 * Each play gets an id of its own, counted up from 1, which `stop` takes.
 * `Sound` and `PlayOptions` are the chip's own types.
 */
export interface CommandWriter<Sound, PlayOptions> extends SongWriter<Sound>, SoundIds<Sound>, Pick<CommandBuffer, 'commands' | 'count' | 'clear'> {
    /** Moves the writer's clock on by `deltaMs`, in ms. */
    update: (deltaMs: number) => void;
    /** Plays `sound` as the chip's `play` does, and returns the play's id. */
    play: (sound: Sound, options?: PlayOptions) => number;
    /** Releases the note of the play with id `id`, as the chip's `stop` does. */
    stop: (id: number) => void;
    /**
     * Releases every voice, music and sounds alike, as soon as it reaches the
     * chip, in its turn with the plays and stops written around it, as a
     * browser's chip takes it. So a sound played just after it still plays.
     */
    releaseAll: () => void;
    /** Takes the next play's id, for a play the writer doesn't write itself, such as a song's. */
    takePlayId: () => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make a chip's writer. */
export interface CommandWriterOptions<Sound> {
    /** The ids the commands name the chip's sounds by, which define each sound for the synthesiser the first time. */
    readonly soundIds: SoundIds<Sound>;
    /** How many commands it holds before it grows. Defaults to 256. */
    readonly capacity?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a chip's writer, with its clock at 0 and nothing written. */
export function createCommandWriter<Sound extends { readonly data: PlayDefaults }, PlayOptions extends AnyPlayOptions>(
    options: CommandWriterOptions<Sound>,
): CommandWriter<Sound, PlayOptions> {
    const { soundIds } = options;
    const buffer = createCommandBuffer({ capacity: options.capacity });
    const write = buffer.write;
    // The clock, in a typed array: V8 boxes a double kept in a closure variable each time it is written, and this is written every tick
    const clock = new Float64Array(1);
    let nextPlayId = 1;

    return {
        get time() {
            return clock[0];
        },
        get commands() {
            return buffer.commands;
        },
        get count() {
            return buffer.count;
        },
        update(deltaMs) {
            clock[0] += deltaMs;
        },
        write,
        soundId: soundIds.soundId,
        forget: soundIds.forget,
        clear: buffer.clear,
        play(sound, playOptions) {
            const play = checkPlay(sound.data, playOptions);
            const id = nextPlayId++;
            writePlay(write, soundIds.soundId(sound), id, play);
            return id;
        },
        stop(id) {
            write(OP_STOP, ASAP_STAMP, id, 0, 0, 0);
        },
        releaseAll() {
            write(OP_RELEASE_ALL, ASAP_STAMP, 0, 0, 0, 0);
        },
        takePlayId: () => nextPlayId++,
    };
}
