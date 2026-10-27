import { setRefresh } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import type { MusicChip, SfxChip } from '#shared';
import { SFX_PREVIEW, MUSIC_PREVIEW } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the volume previews play on, and the volumes they preview. */
export interface VolumePreviewAudioViewBindings {
    /** The page's own chip for music, which plays on while a game is paused. Read once. */
    readonly music: MusicChip<'audio80'>;
    /** The page's own chip for sounds, which plays on while a game is paused. Read once. */
    readonly sfx: SfxChip<'audio80'>;
    /** Whether the menu with the volumes is open. */
    readonly isOpen: () => boolean;
    /** The music's volume, from 0 to 1. 0 is off. */
    readonly musicVolume: () => number;
    /** The sound effects' volume, from 0 to 1. 0 is off. */
    readonly sfxVolume: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Previews the volumes while the pause menu is open. A change to the music's
 * volume plays a short phrase of music, on the page's music chip, and a
 * change to the sound effects' volume plays a blip, on its sound effects
 * chip. Each chip plays at the volume the game's chip of its kind does, so
 * the visitor hears the level they are choosing. Nothing plays as
 * the menu opens, or for a volume turned to 0. The phrase stops when the
 * menu closes.
 *
 * The view has no visuals. It is an empty element that is never hidden, so
 * it is always refreshed. The chip's own sequencer keeps the phrase's place.
 */
export function VolumePreviewAudioView(bindings: VolumePreviewAudioViewBindings): HTMLElement {
    const { music, sfx } = bindings;
    const view = document.createElement('div');
    view.className = 'volume-preview-audio';
    const watcher = watch({ isOpen: bindings.isOpen, musicVolume: bindings.musicVolume, sfxVolume: bindings.sfxVolume });
    // The first refresh hears only what changes after the view is made.
    watcher.poll();

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        if (w.isOpen.changed && !w.isOpen.value) music.stop();
        // A volume that changes in the frame the menu opens was not chosen in the menu. Only a change while the menu is already open plays.
        if (w.isOpen.value && !w.isOpen.changed) {
            if (w.musicVolume.changed && w.musicVolume.value > 0) music.play(MUSIC_PREVIEW);
            if (w.sfxVolume.changed && w.sfxVolume.value > 0) sfx.play(SFX_PREVIEW);
        }
    }
}
