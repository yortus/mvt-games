import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import { BAA, BLOW_OUT, CREAK, EXTRA_LIFE, HATCH, SNAP, SNAPPED_TUNE, STRING_TICK, TIE_OFF } from '../data';
import type { GamePhase } from '../models';
import { CREAK_PERIOD_MS, GameAudioView } from './game-audio-view';

const STEP_MS = 1000 / 60;

// The view is tested by what it asks of its chips: which songs and sounds it plays, and when.

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GameAudioView', () => {
    let state: {
        phase: GamePhase;
        wireSteps: number;
        closures: number;
        sheepPenned: number;
        devilsBlownOut: number;
        beetlesHatched: number;
        extraLivesEarned: number;
        isSlackRunning: boolean;
    };
    let music: HeadlessAudio80;
    let sfx: HeadlessAudio80;
    let view: Container;

    beforeEach(() => {
        state = {
            phase: 'playing',
            wireSteps: 0,
            closures: 0,
            sheepPenned: 0,
            devilsBlownOut: 0,
            beetlesHatched: 0,
            extraLivesEarned: 0,
            isSlackRunning: false,
        };
        music = createSpiedChip();
        sfx = createSpiedChip();
        view = GameAudioView({
            music,
            sfx,
            phase: () => state.phase,
            wireSteps: () => state.wireSteps,
            closures: () => state.closures,
            sheepPenned: () => state.sheepPenned,
            devilsBlownOut: () => state.devilsBlownOut,
            beetlesHatched: () => state.beetlesHatched,
            extraLivesEarned: () => state.extraLivesEarned,
            isSlackRunning: () => state.isSlackRunning,
            share: () => 0.2,
            targetShare: () => 0.7,
        });
        tick();
        vi.clearAllMocks();
    });

    function tick(): void {
        music.update(STEP_MS);
        sfx.update(STEP_MS);
        updateView(view, STEP_MS);
        refreshView(view);
    }

    it('plays a sound for each kind of moment, once each', () => {
        state.wireSteps++;
        state.closures++;
        state.sheepPenned++;
        state.devilsBlownOut++;
        state.beetlesHatched++;
        state.extraLivesEarned++;
        tick();
        tick();
        expect(listPlayed(sfx)).toEqual([STRING_TICK, TIE_OFF, BAA, BLOW_OUT, HATCH, EXTRA_LIFE]);
    });

    it('twangs as the wire snaps, and plays its tune on the music chip', () => {
        state.phase = 'snapped';
        tick();
        expect(listPlayed(sfx)).toEqual([SNAP]);
        expect(listPlayed(music)).toEqual([SNAPPED_TUNE]);
    });

    it('creaks again and again while slack runs, and stops when it stops', () => {
        state.isSlackRunning = true;
        for (let elapsed = 0; elapsed < CREAK_PERIOD_MS * 3; elapsed += STEP_MS) tick();
        expect(listPlayed(sfx).filter((sound) => sound === CREAK)).toHaveLength(3);
        state.isSlackRunning = false;
        vi.clearAllMocks();
        for (let elapsed = 0; elapsed < CREAK_PERIOD_MS * 3; elapsed += STEP_MS) tick();
        expect(sfx.play).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a headless chip whose `play` is spied on, so a test can read what the view asked of it. */
function createSpiedChip(): HeadlessAudio80 {
    const chip = createHeadlessAudio80();
    vi.spyOn(chip, 'play');
    return chip;
}

/** The songs and sounds played on `chip`, oldest first. */
function listPlayed(chip: HeadlessAudio80): unknown[] {
    return vi.mocked(chip.play).mock.calls.map((call) => call[0]);
}
