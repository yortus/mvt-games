import { describe, expect, it, vi } from 'vitest';
import type { Audio90Song } from 'audio90';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { MusicChip } from '@mvtjs/site-kit/shared';
import { AudioView } from './audio-view';

describe('AudioView', () => {
    it('plays on the chip in its refresh step, not its update step', () => {
        const { view, music, state } = setUp();
        state.isPlaying = true;
        state.starts = 1;

        updateView(view, 16);
        expect(music.play).not.toHaveBeenCalled();

        refreshView(view);
        expect(music.play).toHaveBeenCalledTimes(1);
    });

    it('stops the chip as the tracker stops', () => {
        const { view, music, state } = setUp();
        state.isPlaying = true;
        state.starts = 1;
        refreshView(view);

        state.isPlaying = false;
        refreshView(view);
        expect(music.stop).toHaveBeenCalledTimes(1);
    });

    it('plays nothing more on a second refresh of the same state', () => {
        const { view, music, state } = setUp();
        state.isPlaying = true;
        state.starts = 1;
        refreshView(view);
        refreshView(view);
        expect(music.play).toHaveBeenCalledTimes(1);
    });
});

function setUp() {
    const state = { isPlaying: false, starts: 0 };
    const music = { play: vi.fn(), stop: vi.fn() };
    const view = AudioView({
        music: music as unknown as MusicChip<'audio90'>,
        songAt: () => ({}) as Audio90Song,
        tuneIndex: () => 0,
        isPlaying: () => state.isPlaying,
        starts: () => state.starts,
    });
    return { view, music, state };
}
