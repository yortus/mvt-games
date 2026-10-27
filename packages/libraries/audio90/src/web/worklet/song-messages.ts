// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the page sends a chip's sequencer in the worklet. `song` sends a song
 * once, under an id, with the ids the page gave its instruments. `song-call`
 * asks the sequencer to play, queue or stop a song, or to change its tempo
 * scale.
 *
 * Each call carries a generation, which rises with each call that changes
 * the song. The worklet sends it back with each place, so the page can tell
 * a place of the song it asked for from one of a song before.
 */
export type SongMessage =
    | { readonly kind: 'song'; readonly id: number; readonly song: object; readonly soundIds: readonly number[] }
    | SongCallMessage;

/** A call to a chip's sequencer. `songId` names the song for `play` and `queue`, and `value` is the scale for `tempo`. */
export interface SongCallMessage {
    readonly kind: 'song-call';
    readonly generation: number;
    readonly call: SongCall;
    readonly songId: number;
    readonly value: number;
}

/** What a call to the sequencer asks for. */
export type SongCall = 'play' | 'queue' | 'stop' | 'tempo';

/**
 * What a chip's sequencer sends as its song reaches a new row, or starts or
 * stops: the generation of the last call it applied, the audio context's
 * frame the row starts at, and where the song is. A `songId` of 0 means no
 * song is playing.
 */
export interface SongPlaceReply {
    readonly kind: 'song-place';
    readonly generation: number;
    readonly frame: number;
    readonly songId: number;
    readonly orderIndex: number;
    readonly row: number;
    readonly beat: number;
    readonly tempoScale: number;
}
