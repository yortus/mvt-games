import { Container } from 'pixi.js';
import type { Audio90Song, MusicPlayer } from 'audio90';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the Tune Tracker's audio view plays through, what it plays, and the state it plays it from. */
export interface TrackerAudioViewBindings {
    /** The music player to play through, which the tracker's views share. It is the view's output, so the view reads it once. */
    readonly music: MusicPlayer<Audio90Song>;
    /** The song of each tune, by its index. */
    readonly songAt: (index: number) => Audio90Song;
    readonly tuneIndex: () => number;
    readonly isPlaying: () => boolean;
    /** How many times a tune has started. Each rise is one more start. */
    readonly starts: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays what the tracker says. It starts the tune chosen from its beginning
 * each time a tune starts, and stops it when the tracker stops. Which tune
 * plays is presentation state, so the view starts and stops it in its update
 * step, and its refresh step sends that to the chip. The chip's own sequencer
 * keeps the tune's place, and the pattern view reads the music player to show
 * the row being heard. The view draws nothing.
 */
export function TrackerAudioView(bindings: TrackerAudioViewBindings): Container {
    const { music } = bindings;
    const view = new Container();
    const watcher = watch({ isPlaying: bindings.isPlaying, starts: bindings.starts });

    setUpdate(view, update);
    setRefresh(view, () => music.refresh());
    return view;

    function update(): void {
        const w = watcher.poll();
        if (!w.isPlaying.value) {
            if (w.isPlaying.changed) music.stop();
        }
        // A start before the view's first poll counts too, so `changed`, not `increased`: the count only rises
        else if (w.starts.changed) music.play(bindings.songAt(bindings.tuneIndex()));
    }
}
