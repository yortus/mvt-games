// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { type Audio80Write, createHeadlessAudio80 } from 'audio90/headless';
import { refreshView, updateView } from '@mvtjs/html';
import { SFX_PREVIEW, MUSIC_PREVIEW } from '../data';
import { VolumePreviewAudioView } from './volume-preview-audio-view';

describe('VolumePreviewAudioView', () => {
    it('previews a change to the music\'s volume with a phrase on the music chip, and to the sound effects\' with a blip on theirs', () => {
        const { view, state, music, sfx } = setUp();
        state.musicVolume = 0.7;
        state.sfxVolume = 0.3;
        refreshView(view);
        expect(music.song).toBe(MUSIC_PREVIEW);
        expect(listPlays(sfx.log)).toEqual([SFX_PREVIEW]);
    });

    it('previews nothing as the menu opens, nor a volume turned off', () => {
        const { view, state, music, sfx } = setUp({ isOpen: false });
        state.isOpen = true;
        state.musicVolume = 0.9;
        refreshView(view);
        state.sfxVolume = 0;
        refreshView(view);
        expect([music.log, sfx.log]).toEqual([[], []]);
    });

    it('stops the music\'s preview as the menu closes', () => {
        const { view, state, music } = setUp();
        state.musicVolume = 0.7;
        refreshView(view);
        updateView(view, PHRASE_STARTED_MS);
        refreshView(view);
        expect(music.song).toBe(MUSIC_PREVIEW);
        state.isOpen = false;
        refreshView(view);
        expect(music.song).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setUp(initial: { isOpen?: boolean } = {}) {
    const state = {
        isOpen: initial.isOpen ?? true,
        musicVolume: 0.5,
        sfxVolume: 0.5,
    };
    const music = createHeadlessAudio80({ record: true });
    const sfx = createHeadlessAudio80({ record: true });
    const view = VolumePreviewAudioView({
        music,
        sfx,
        isOpen: () => state.isOpen,
        musicVolume: () => state.musicVolume,
        sfxVolume: () => state.sfxVolume,
    });
    refreshView(view);
    return { view, state, music, sfx };
}

/** A moment into the music's preview, once some of it has played. */
const PHRASE_STARTED_MS = 100;

/** The sound effects played, in order. */
function listPlays(log: readonly Audio80Write[]): unknown[] {
    return log.filter((write) => write.kind === 'play').map((write) => (write as { sound: unknown }).sound);
}
