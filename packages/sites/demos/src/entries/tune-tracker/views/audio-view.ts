import { Container } from 'pixi.js';
import type { Audio90Song } from 'audio90';
import { setRefresh } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import type { MusicChip } from '@mvtjs/site-kit/shared';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the Tune Tracker's audio view plays through, what it plays, and the state it plays it from. */
export interface AudioViewBindings {
    /** The chip the music plays on. It is the view's output, so the view reads it once. */
    readonly music: MusicChip<'audio90'>;
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
 * each time a tune starts, and stops it when the tracker stops. The chip is
 * this view's output, so the view plays on it in its refresh step. The chip's
 * own sequencer keeps the tune's place, and the pattern view reads the chip to
 * show the row being heard. The view draws nothing.
 */
export function AudioView(bindings: AudioViewBindings): Container {
    const { music } = bindings;
    const view = new Container();
    const watcher = watch({ isPlaying: bindings.isPlaying, starts: bindings.starts });
    // A tune already playing as the view is made starts now
    if (bindings.isPlaying()) music.play(bindings.songAt(bindings.tuneIndex()));

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        if (!w.isPlaying.current) {
            if (w.isPlaying.changed) music.stop();
        }
        else if (w.starts.increased) {
            music.play(bindings.songAt(bindings.tuneIndex()));
        }
    }
}
