import { beforeEach, describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from 'audio90/headless';
import { BAA, BLOW_OUT, CREAK, EXTRA_LIFE, HATCH, SNAP, STRING_TICK, TIE_OFF } from '../data';
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
    let chip: ReturnType<typeof createHeadlessAudio80<{ record: true }>>;
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
        chip = createHeadlessAudio80({ record: true });
        view = GameAudioView({
            sound: chip.audio80,
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
        chip.audio80.clear();
    });

    function tick(): void {
        chip.controls.update(STEP_MS);
        updateView(view, STEP_MS);
        refreshView(view);
    }

    function played(): unknown[] {
        return chip.audio80.log.filter((entry) => entry.kind === 'play').map((entry) => (entry as { effect: unknown }).effect);
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

    it('twangs as the wire snaps', () => {
        state.phase = 'snapped';
        tick();
        expect(played()).toEqual([SNAP]);
    });

    it('creaks again and again while slack runs, and stops when it stops', () => {
        state.isSlackRunning = true;
        for (let elapsed = 0; elapsed < CREAK_PERIOD_MS * 3; elapsed += STEP_MS) tick();
        expect(played().filter((effect) => effect === CREAK).length).toBe(3);
        state.isSlackRunning = false;
        chip.audio80.clear();
        for (let elapsed = 0; elapsed < CREAK_PERIOD_MS * 3; elapsed += STEP_MS) tick();
        expect(played()).toEqual([]);
    });

    it('stays quiet as counts go back to 0 for a new round', () => {
        state.wireSteps = 30;
        state.closures = 4;
        tick();
        chip.audio80.clear();
        state.wireSteps = 0;
        state.closures = 0;
        tick();
        expect(played()).toEqual([]);
    });
});
