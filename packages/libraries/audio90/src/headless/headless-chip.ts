import {
    type AnyPlayOptions,
    clampVolume,
    type CommandWriter,
    createChipPlayback,
    createCommandWriter,
    joinMembers,
    createSongPlayer,
    type PlayableSong,
    type PlayDefaults,
    type SongCallbacks,
    type SongDriver,
    type SoundChip,
} from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What every headless chip has: the members every chip has, and `update`,
 * which moves its clock on. A headless chip has no sound card to keep its
 * time, so the code that owns it moves its clock on, by the same ticks as
 * the game's models. So the same ticks always make the same notes, which is
 * what makes a test of the sound exact.
 */
export interface HeadlessChip<Song, Sound, PlayOptions> extends SoundChip<Song, Sound, PlayOptions> {
    /**
     * Moves the chip's clock, and its song, on by `deltaMs`. Call it once a
     * tick with the models' delta, before the views update. While the chip is
     * paused, it does nothing.
     */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What a headless chip's shared members pass their work to. */
export interface HeadlessChipOptions<Song extends PlayableSong, Sound extends object, PlayOptions> {
    /**
     * What the chip writes through, which its song writes its notes through
     * too: a synthesiser's in memory, for a chip that renders, or a silent
     * writer, for one that doesn't.
     */
    readonly writer: Pick<CommandWriter<Sound, PlayOptions>, 'update' | 'play' | 'stop' | 'releaseAll' | 'takePlayId'>;
    /** What writes the chip's songs to `writer`. */
    readonly driver: SongDriver<Song>;
    /** What the chip calls as its songs reach each row, and end by themselves. */
    readonly callbacks?: SongCallbacks<Song>;
    /** Cuts every voice at once, as `stop` does while the chip is paused, on a chip that renders. A chip that doesn't has nothing to cut. */
    readonly cut?: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the members every headless chip has, with its clock at 0, unpaused, and no song playing. */
export function createHeadlessChip<Song extends PlayableSong, Sound extends object, PlayOptions>(options: HeadlessChipOptions<Song, Sound, PlayOptions>): HeadlessChip<Song, Sound, PlayOptions> {
    const { writer, driver, cut, callbacks } = options;
    const onRow = callbacks?.onRow;
    const onEnded = callbacks?.onEnded;
    // The rows and ends the player reached since the last update, held for the callbacks until it ends. An end
    // is held as a row of -1
    const heldSongs: Song[] = [];
    const heldOrderIndexes: number[] = [];
    const heldRows: number[] = [];
    const hold = (song: Song, orderIndex: number, row: number): void => {
        heldSongs.push(song);
        heldOrderIndexes.push(orderIndex);
        heldRows.push(row);
    };
    const player = createSongPlayer({
        driver,
        onRow: onRow === undefined ? undefined : hold,
        onEnded: onEnded === undefined ? undefined : (song) => hold(song, 0, ENDED),
    });
    let volume = 1;
    let isMuted = false;
    let isPaused = false;

    const playback = createChipPlayback<Song, Sound, PlayOptions>({
        // Each call takes effect at once, at the chip's time, and the song heard is the song playing, since a
        // headless chip has no speaker to wait for
        songs: player,
        playSound: writer.play,
        stopSound: writer.stop,
        takePlayId: writer.takePlayId,
        stopVoices,
    });

    return joinMembers(playback, {
        ready: Promise.resolve(),
        get isPaused() {
            return isPaused;
        },
        get volume() {
            return volume;
        },
        set volume(value: number) {
            volume = clampVolume(value);
        },
        get isMuted() {
            return isMuted;
        },
        set isMuted(value: boolean) {
            isMuted = value;
        },
        pause() {
            isPaused = true;
        },
        resume() {
            isPaused = false;
        },
        update(deltaMs: number) {
            if (isPaused) return;
            writer.update(deltaMs);
            player.update(deltaMs);
            if (heldSongs.length > 0) callHeld();
        },
        destroy: ignore,
    });

    /** Calls the callbacks for the rows and ends held, in the order they happened, and forgets them. */
    function callHeld(): void {
        for (let i = 0; i < heldSongs.length; i++) {
            if (heldRows[i] === ENDED) onEnded?.(heldSongs[i]);
            else onRow?.(heldSongs[i], heldOrderIndexes[i], heldRows[i]);
        }
        heldSongs.length = 0;
        heldOrderIndexes.length = 0;
        heldRows.length = 0;
    }

    /** Stops every voice's note, once the song has stopped: cuts them while paused, as a browser's chip does, or else releases them. */
    function stopVoices(): void {
        if (!isPaused || cut === undefined) {
            writer.releaseAll();
            return;
        }
        cut();
    }
}

/**
 * Creates the writer of a chip that doesn't render, with its clock at 0. It
 * checks and numbers each play, as every chip does, and its songs write to
 * it, but its commands go nowhere: it empties itself each time its clock
 * moves on, so it never grows.
 */
export function createSilentWriter<Sound extends { readonly data: PlayDefaults }, PlayOptions extends AnyPlayOptions>(): CommandWriter<Sound, PlayOptions> {
    // No sound is defined anywhere, so every sound has the same id
    const writer = createCommandWriter<Sound, PlayOptions>({ soundIds: { soundId: () => 0, forget: ignore } });
    const update = writer.update;
    return joinMembers(writer, {
        update(deltaMs: number) {
            writer.clear();
            update(deltaMs);
        },
    });
}

/** The sample rate a headless chip renders at unless it is told another, in Hz. */
export const DEFAULT_SAMPLE_RATE = 48000;

/** The row an end is held as. */
const ENDED = -1;

/** Does nothing. */
function ignore(): void {
    // Nothing to do
}
