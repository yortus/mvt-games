// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { type ChipWrite, createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { refreshView, updateView } from '@mvtjs/html';
import { EFFECTS_PREVIEW, MUSIC_PREVIEW } from '../data';
import { VolumePreviewAudioView } from './volume-preview-audio-view';

describe('VolumePreviewAudioView', () => {
    it('previews a change to the music\'s volume with a phrase, and to the effects\' volume with a blip', () => {
        const { view, state, chip } = setUp();
        state.musicVolume = 0.7;
        state.effectsVolume = 0.3;
        refreshView(view);
        expect(chip.log).toContainEqual(expect.objectContaining({ kind: 'reserve-voices', count: MUSIC_PREVIEW.channelCount }));
        expect(listPlays(chip.log)).toEqual([EFFECTS_PREVIEW]);
    });

    it('previews nothing as the menu opens, nor a volume turned off', () => {
        const { view, state, chip } = setUp({ isOpen: false });
        state.isOpen = true;
        state.musicVolume = 0.9;
        refreshView(view);
        state.effectsVolume = 0;
        refreshView(view);
        expect(chip.log).toHaveLength(0);
    });

    it('stops the music\'s preview as the menu closes', () => {
        const { view, state, chip } = setUp();
        state.musicVolume = 0.7;
        refreshView(view);
        updateView(view, PHRASE_STARTED_MS);
        refreshView(view);
        state.isOpen = false;
        refreshView(view);
        expect(chip.log[chip.log.length - 1]).toMatchObject({ kind: 'reserve-voices', count: 0 });
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setUp(initial: { isOpen?: boolean } = {}) {
    const state = {
        isOpen: initial.isOpen ?? true,
        musicVolume: 0.5,
        effectsVolume: 0.5,
    };
    const { audio80: chip } = createHeadlessAudio80({ record: true });
    const view = VolumePreviewAudioView({
        sound: chip,
        isOpen: () => state.isOpen,
        musicVolume: () => state.musicVolume,
        effectsVolume: () => state.effectsVolume,
    });
    refreshView(view);
    return { view, state, chip };
}

/** A moment into the music's preview, once some of it has played. */
const PHRASE_STARTED_MS = 100;

/** The sound effects played, in order. */
function listPlays(log: readonly ChipWrite[]): unknown[] {
    return log.filter((write) => write.kind === 'play').map((write) => (write as { effect: unknown }).effect);
}
