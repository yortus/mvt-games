import { clampVolume, createChipPlayback, joinMembers, type PlayingWriter, type SongSequencer, type SoundChip } from '../shared';
import type { PlayableSong, SongPlayer } from '../song-player';

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
     * too. It logs its writes, renders them, both, or neither, as the chip
     * was asked to.
     */
    readonly writer: Pick<PlayingWriter<Sound, PlayOptions>, 'update' | 'play' | 'stop' | 'releaseAll' | 'takePlayId'>;
    /** The song player that plays the chip's songs on `writer`. */
    readonly player: SongPlayer<Song>;
    /** Cuts every voice at once, as `stop` does while the chip is paused, on a chip that renders. A chip that doesn't has nothing to cut. */
    readonly cut?: () => void;
    /** Logs a call to `stop`, on a chip that records. */
    readonly logStop?: (id: number | undefined) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the members every headless chip has, with its clock at 0, unpaused, and no song playing. */
export function createHeadlessChip<Song extends PlayableSong, Sound extends object, PlayOptions>(options: HeadlessChipOptions<Song, Sound, PlayOptions>): HeadlessChip<Song, Sound, PlayOptions> {
    const { writer, player, cut, logStop } = options;
    let volume = 1;
    let isMuted = false;
    let isPaused = false;

    // Each call takes effect at once, at the chip's time, and the song heard is the song playing, since a
    // headless chip has no speaker to wait for
    const songs: SongSequencer<Song> = {
        get song() {
            return player.song;
        },
        get orderIndex() {
            return player.orderIndex;
        },
        get row() {
            return player.row;
        },
        get beat() {
            return player.beat;
        },
        play(song) {
            player.play(song);
            player.refresh();
        },
        queue(song) {
            player.queue(song);
            player.refresh();
        },
        stop() {
            player.stop();
            player.refresh();
        },
        setTempoScale(scale) {
            // The player tells the chip at its next update, which plays at the new tempo from then
            player.tempoScale = scale;
        },
    };
    const playback = createChipPlayback<Song, Sound, PlayOptions>({
        songs,
        playSound: writer.play,
        stopSound: writer.stop,
        takePlayId: writer.takePlayId,
        stopVoices,
    });
    const stopPlay = playback.stop;

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
        stop(id?: number) {
            logStop?.(id);
            stopPlay(id);
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
            player.refresh();
        },
        destroy: ignore,
    });

    /** Stops every voice's note, once the song has stopped: cuts them while paused, as a browser's chip does, or else releases them. */
    function stopVoices(): void {
        if (!isPaused || cut === undefined) {
            writer.releaseAll();
            return;
        }
        cut();
    }
}

/** Does nothing. A silent chip's writes are this function. */
export function ignore(): void {
    // Nothing to do
}
