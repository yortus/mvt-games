import { beforeEach, describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80, type HeadlessAudio80 } from 'audio90/headless';
import { BAA, BLOW_OUT, CREAK, EXTRA_LIFE, HATCH, SNAP, SNAPPED_TUNE, STRING_TICK, TIE_OFF } from '../data';
import type { GamePhase } from '../models';
import { CREAK_PERIOD_MS, GameAudioView } from './game-audio-view';

const STEP_MS = 1000 / 60;

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
        music = createHeadlessAudio80({ record: true });
        sfx = createHeadlessAudio80({ record: true });
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
        sfx.clear();
    });

    function tick(): void {
        music.update(STEP_MS);
        sfx.update(STEP_MS);
        updateView(view, STEP_MS);
        refreshView(view);
    }

    function played(): unknown[] {
        return sfx.log.filter((entry) => entry.kind === 'play').map((entry) => (entry as { sound: unknown }).sound);
    }

    it('plays nothing while nothing changes', () => {
        for (let i = 0; i < 30; i++) tick();
        expect(played()).toEqual([]);
    });

    it('plays a sound for each kind of moment, once each', () => {
        state.wireSteps++;
        state.closures++;
        state.sheepPenned++;
        state.devilsBlownOut++;
        state.beetlesHatched++;
        state.extraLivesEarned++;
        tick();
        tick();
        expect(played()).toEqual([STRING_TICK, TIE_OFF, BAA, BLOW_OUT, HATCH, EXTRA_LIFE]);
    });

    it('twangs as the wire snaps, and plays its tune on the music chip', () => {
        state.phase = 'snapped';
        tick();
        expect(played()).toEqual([SNAP]);
        expect(music.song).toBe(SNAPPED_TUNE);
    });

    it('creaks again and again while slack runs, and stops when it stops', () => {
        state.isSlackRunning = true;
        for (let elapsed = 0; elapsed < CREAK_PERIOD_MS * 3; elapsed += STEP_MS) tick();
        expect(played().filter((effect) => effect === CREAK).length).toBe(3);
        state.isSlackRunning = false;
        sfx.clear();
        for (let elapsed = 0; elapsed < CREAK_PERIOD_MS * 3; elapsed += STEP_MS) tick();
        expect(played()).toEqual([]);
    });

    it('stays quiet as counts go back to 0 for a new round', () => {
        state.wireSteps = 30;
        state.closures = 4;
        tick();
        sfx.clear();
        state.wireSteps = 0;
        state.closures = 0;
        tick();
        expect(played()).toEqual([]);
    });
});
