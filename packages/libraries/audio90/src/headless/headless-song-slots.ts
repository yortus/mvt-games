import type { PlayableSong, SongPlayer } from '../music-player';
import type { SongSlot } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A headless chip's sequencer: a song player for each slot it opens, run in
 * step with the chip's clock. A call to a slot takes effect at once, at the
 * chip's time, and the slot reports where its song is now, since a headless
 * chip has no speaker to wait for. So the same ticks always make the same
 * notes.
 */
export interface HeadlessSongSlots<S extends PlayableSong> {
    /** Opens a slot, with no song playing. */
    open: () => SongSlot<S>;
    /** Moves every slot's song on by `deltaMs`, and writes its notes. Call it once the chip's clock has advanced by `deltaMs`. */
    update: (deltaMs: number) => void;
    /** Stops every slot's song, as the chip resets. */
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface HeadlessSongSlotsOptions<S extends PlayableSong> {
    /** Creates a song player that writes to the chip. */
    readonly createPlayer: () => SongPlayer<S>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a sequencer with no slots open. */
export function createHeadlessSongSlots<S extends PlayableSong>(options: HeadlessSongSlotsOptions<S>): HeadlessSongSlots<S> {
    const players: SongPlayer<S>[] = [];

    return {
        open() {
            const player = options.createPlayer();
            players.push(player);
            return {
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
        },

        update(deltaMs) {
            for (let i = 0; i < players.length; i++) {
                players[i].update(deltaMs);
                players[i].refresh();
            }
        },

        reset() {
            for (let i = 0; i < players.length; i++) {
                players[i].stop();
                players[i].refresh();
            }
        },
    };
}
