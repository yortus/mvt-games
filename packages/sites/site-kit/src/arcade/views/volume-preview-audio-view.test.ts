// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import { refreshView, updateView } from '@mvtjs/html';
import { SFX_PREVIEW, MUSIC_PREVIEW } from '../data';
import { VolumePreviewAudioView } from './volume-preview-audio-view';

// The view is tested by what it asks of its chips: which phrase and blip it plays, and when it stops the phrase.

afterEach(() => {
    vi.restoreAllMocks();
});

describe('VolumePreviewAudioView', () => {
    it('previews a change to the music\'s volume with a phrase on the music chip, and to the sound effects\' with a blip on theirs', () => {
        const { view, state, music, sfx } = setUp();
        state.musicVolume = 0.7;
        state.sfxVolume = 0.3;
        refreshView(view);
        expect(listPlayed(music)).toEqual([MUSIC_PREVIEW]);
        expect(music.song).toBe(MUSIC_PREVIEW);
        expect(listPlayed(sfx)).toEqual([SFX_PREVIEW]);
    });

    it('previews nothing as the menu opens, nor a volume turned off', () => {
        const { view, state, music, sfx } = setUp({ isOpen: false });
        state.isOpen = true;
        state.musicVolume = 0.9;
        refreshView(view);
        state.sfxVolume = 0;
        refreshView(view);
        expect(music.play).not.toHaveBeenCalled();
        expect(sfx.play).not.toHaveBeenCalled();
        expect(music.stop).not.toHaveBeenCalled();
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
        expect(music.stop).toHaveBeenCalledOnce();
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
    const music = createSpiedChip();
    const sfx = createSpiedChip();
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

/** Creates a headless chip whose `play` and `stop` are spied on, so a test can read what the view asked of it. */
function createSpiedChip(): HeadlessAudio80 {
    const chip = createHeadlessAudio80();
    vi.spyOn(chip, 'play');
    vi.spyOn(chip, 'stop');
    return chip;
}

/** The songs and sounds played on `chip`, oldest first. */
function listPlayed(chip: HeadlessAudio80): unknown[] {
    return vi.mocked(chip.play).mock.calls.map((call) => call[0]);
}
