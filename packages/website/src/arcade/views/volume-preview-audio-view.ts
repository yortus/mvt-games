import { type Audio80, createMusicPlayer } from '@mvtjs/audio';
import { setRefresh, setUpdate } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import { EFFECTS_PREVIEW, MUSIC_PREVIEW } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the volume previews play on, and the volumes they preview. */
export interface VolumePreviewAudioViewBindings {
    /** The page's own chip, which plays on while a game is paused. Read once. */
    readonly sound: Audio80;
    /** Whether the menu with the volumes is open. */
    readonly isOpen: () => boolean;
    /** The music's volume, from 0 to 1. 0 is off. */
    readonly musicVolume: () => number;
    /** The effects' volume, from 0 to 1. 0 is off. */
    readonly effectsVolume: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Previews the volumes while the pause menu is open. A change to the music's
 * volume plays a short phrase of music, and a change to the effects' volume
 * plays a blip. Both play on the page's chip through the same volumes as the
 * game, so the visitor hears the level they are choosing. Nothing plays as
 * the menu opens, or for a volume turned to 0. The phrase stops when the
 * menu closes.
 *
 * The view draws nothing. It is an empty element that is never hidden, so it
 * is always ticked. Where the phrase has got to is its presentation state.
 */
export function VolumePreviewAudioView(bindings: VolumePreviewAudioViewBindings): HTMLElement {
    const { sound } = bindings;
    const view = document.createElement('div');
    view.className = 'volume-preview-audio';
    const music = createMusicPlayer({ audio80: sound });
    const watcher = watch({ isOpen: bindings.isOpen, music: bindings.musicVolume, effects: bindings.effectsVolume });
    // The first refresh hears only what changes after the view is made.
    watcher.poll();

    setUpdate(view, (deltaMs) => music.update(deltaMs));
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        if (w.isOpen.changed && !w.isOpen.value) music.stop();
        // A volume that changes in the frame the menu opens was not chosen in the menu. Only a change while the menu is already open plays.
        if (w.isOpen.value && !w.isOpen.changed) {
            if (w.music.changed && w.music.value > 0) music.play(MUSIC_PREVIEW);
            if (w.effects.changed && w.effects.value > 0) sound.play(EFFECTS_PREVIEW);
        }
        music.refresh();
    }
}
