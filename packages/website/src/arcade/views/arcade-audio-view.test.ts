// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { SoundEffect } from '@mvtjs/audio';
import { type ChipWrite, createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { refreshView } from '@mvtjs/html';
import {
    BURN, CARD_TICK, DEVELOP, KEY_TICK_HIGH, KEY_TICK_LOW, LAUNCH, LOAD_FAILED, NO_RESULTS, PANEL_CLOSE, PANEL_OPEN, PAUSE, POWER_OFF,
    POWER_ON, RESUME, TAG_ADD, TAG_REMOVE,
} from '../data';
import type { ArcadePhase } from '../models';
import { POWER_OFF_BEAM_MS, POWER_ON_BEAM_MS, type TransitionPhase, type WallEffectKind } from './transition-view-model';
import { ArcadeAudioView } from './arcade-audio-view';

describe('ArcadeAudioView', () => {
    it('plays nothing for the page as it first is', () => {
        const { chip } = setUp({ phase: 'playing', isPaused: true, searchText: 'boid', shownCount: 0 });
        expect(listPlays(chip.log)).toEqual([]);
    });

    it('ticks high and low by turns as the search is typed in, and plays one sound for a tag chosen or removed', () => {
        const { chip, state, tick } = setUp();
        state.searchText = 'a';
        tick();
        state.searchText = 'ab';
        tick();
        state.chosenTagCount = 1;
        state.searchText = '';
        tick();
        state.chosenTagCount = 0;
        tick();
        expect(listPlays(chip.log)).toEqual([KEY_TICK_HIGH, KEY_TICK_LOW, TAG_ADD, TAG_REMOVE]);
    });

    it('bonks as a search matches nothing', () => {
        const { chip, state, tick } = setUp();
        state.searchText = 'zz';
        state.shownCount = 0;
        tick();
        expect(listPlays(chip.log)).toContain(NO_RESULTS);
    });

    it('blips as a panel opens and closes, and ticks as the keyboard moves between cards', () => {
        const { chip, state, tick } = setUp();
        state.isPanelOpen = true;
        tick();
        state.isPanelOpen = false;
        tick();
        state.cardKeyMoves++;
        tick();
        expect(listPlays(chip.log)).toEqual([PANEL_OPEN, PANEL_CLOSE, CARD_TICK]);
    });

    it('plays the coin, the burn, the screen powering on and off, and the cards developing, on the way in and out', () => {
        const { chip, state, tick } = setUp();
        state.phase = 'loading';
        state.transitionPhase = 'entering';
        state.wallEffect = 'burn';
        tick();
        state.wallEffect = 'none';
        state.transitionPhase = 'powering-on';
        state.isBeamOn = true;
        tick();
        state.isBeamOn = false;
        tick();
        state.transitionPhase = 'powering-off';
        tick();
        state.isBeamOn = true;
        tick();
        state.isBeamOn = false;
        state.transitionPhase = 'returning';
        state.wallEffect = 'develop';
        tick();
        expect(listPlays(chip.log)).toEqual([LAUNCH, BURN, POWER_ON, POWER_OFF, DEVELOP]);
    });

    it('plays no static while there is no beam, as when less motion is asked for', () => {
        const { chip, state, tick } = setUp();
        state.transitionPhase = 'powering-on';
        tick();
        state.transitionPhase = 'powering-off';
        tick();
        expect(listPlays(chip.log)).toEqual([]);
    });

    it('makes each burst of static last as long as the beam', () => {
        expect(POWER_ON.data.lengthMs).toBe(POWER_ON_BEAM_MS);
        expect(POWER_OFF.data.lengthMs).toBe(POWER_OFF_BEAM_MS);
    });

    it('chimes as an entry pauses and resumes, but not as leaving it clears the pause', () => {
        const { chip, state, tick } = setUp({ phase: 'playing' });
        state.isPaused = true;
        tick();
        state.isPaused = false;
        tick();
        state.isPaused = true;
        tick();
        state.phase = 'browsing';
        state.isPaused = false;
        tick();
        expect(listPlays(chip.log)).toEqual([PAUSE, RESUME, PAUSE]);
    });

    it('buzzes for an entry that could not load', () => {
        const { chip, state, tick } = setUp();
        state.loadFailure = 'It would not load.';
        tick();
        expect(listPlays(chip.log)).toEqual([LOAD_FAILED]);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface State {
    phase: ArcadePhase;
    isPaused: boolean;
    isPanelOpen: boolean;
    searchText: string;
    chosenTagCount: number;
    shownCount: number;
    loadFailure: string | undefined;
    transitionPhase: TransitionPhase;
    wallEffect: WallEffectKind;
    isBeamOn: boolean;
    cardKeyMoves: number;
}

function setUp(initial: Partial<State> = {}) {
    const state: State = {
        phase: 'browsing', isPaused: false, isPanelOpen: false, searchText: '', chosenTagCount: 0, shownCount: 12,
        loadFailure: undefined, transitionPhase: 'idle', wallEffect: 'none', isBeamOn: false, cardKeyMoves: 0, ...initial,
    };
    const { audio80: chip } = createHeadlessAudio80({ record: true });
    const view = ArcadeAudioView({
        sound: chip,
        phase: () => state.phase,
        isPaused: () => state.isPaused,
        isPanelOpen: () => state.isPanelOpen,
        searchText: () => state.searchText,
        chosenTagCount: () => state.chosenTagCount,
        shownCount: () => state.shownCount,
        loadFailure: () => state.loadFailure,
        transitionPhase: () => state.transitionPhase,
        isBeamOn: () => state.isBeamOn,
        wallEffect: () => state.wallEffect,
        cardKeyMoves: () => state.cardKeyMoves,
    });
    const tick = (): void => refreshView(view);
    tick();
    return { chip, state, tick };
}

function listPlays(log: readonly ChipWrite[]): SoundEffect[] {
    return log.filter((write): write is Extract<ChipWrite, { kind: 'play' }> => write.kind === 'play').map((write) => write.effect);
}
