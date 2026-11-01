// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/html';
import { RunnerView } from './runner-view';

describe('RunnerView', () => {
    it('shows whether any sound is on on its speaker, and reports a press', () => {
        const { runner, state } = setUp();
        const speaker = runner.querySelector<HTMLButtonElement>('.runner-sound')!;
        expect(speaker.getAttribute('aria-pressed')).toBe('true');
        state.isSoundOn = false;
        refreshView(runner);
        expect(speaker.getAttribute('aria-pressed')).toBe('false');
        expect(speaker.classList.contains('is-off')).toBe(true);
        speaker.click();
        expect(state.soundPresses).toBe(1);
    });

    it('shows whether the Perfmon is open on its gauge, and reports a press', () => {
        const { runner, state } = setUp();
        const gauge = runner.querySelector<HTMLButtonElement>('.runner-perfmon')!;
        expect(gauge.getAttribute('aria-pressed')).toBe('false');
        state.isPerfmonOpen = true;
        refreshView(runner);
        expect(gauge.getAttribute('aria-pressed')).toBe('true');
        expect(gauge.classList.contains('is-on')).toBe(true);
        gauge.click();
        expect(state.perfmonPresses).toBe(1);
    });

    it('pauses with its pause button, and resumes as it is pressed again', () => {
        const { runner, state } = setUp();
        const pause = runner.querySelector<HTMLButtonElement>('.runner-pause')!;
        pause.click();
        expect(state.isPaused).toBe(true);
        refreshView(runner);
        expect(pause.getAttribute('aria-pressed')).toBe('true');
        expect(pause.title).toBe('Resume');
        pause.click();
        expect(state.isPaused).toBe(false);
    });

    it('opens the info panel from its (i), and hides the pause menu while the panel is over the entry', () => {
        const { runner, state } = setUp();
        const info = runner.querySelector<HTMLButtonElement>('.runner-info')!;
        info.click();
        expect(state.infoPresses).toBe(1);
        state.isPaused = true;
        refreshView(runner);
        expect(runner.querySelector('.pause-menu')!.hasAttribute('hidden')).toBe(false);
        state.isInfoOpen = true;
        refreshView(runner);
        expect(info.getAttribute('aria-pressed')).toBe('true');
        expect(runner.querySelector('.pause-menu')!.hasAttribute('hidden')).toBe(true);
    });

    it('says the sound is off only while an entry plays with the sound off by default', () => {
        const { runner, state } = setUp();
        state.isSoundOn = false;
        refreshView(runner);
        expect(isHintShown(runner)).toBe(false);
        state.isSoundOffByDefault = true;
        refreshView(runner);
        expect(isHintShown(runner)).toBe(true);
        state.isPlaying = false;
        refreshView(runner);
        expect(isHintShown(runner)).toBe(false);
    });

    it('turns the sound on as its hint is pressed', () => {
        const { runner, state } = setUp();
        state.isSoundOffByDefault = true;
        refreshView(runner);
        runner.querySelector<HTMLButtonElement>('.runner-sound-hint-text')!.click();
        expect(state.soundPresses).toBe(1);
    });

    it('hides its hint for good once the visitor waves it away', () => {
        const { runner, state } = setUp();
        state.isSoundOffByDefault = true;
        refreshView(runner);
        runner.querySelector<HTMLButtonElement>('.runner-sound-hint [aria-label="Dismiss"]')!.click();
        refreshView(runner);
        expect(isHintShown(runner)).toBe(false);
        state.isPlaying = false;
        refreshView(runner);
        state.isPlaying = true;
        refreshView(runner);
        expect(isHintShown(runner)).toBe(false);
    });
});

interface RunnerState {
    isPlaying: boolean;
    isSoundOn: boolean;
    isSoundOffByDefault: boolean;
    soundPresses: number;
    isPerfmonOpen: boolean;
    perfmonPresses: number;
    isPaused: boolean;
    isInfoOpen: boolean;
    infoPresses: number;
}

function setUp(): { runner: Element; state: RunnerState } {
    const state: RunnerState = { isPlaying: true, isSoundOn: true, isSoundOffByDefault: false, soundPresses: 0, isPerfmonOpen: false, perfmonPresses: 0, isPaused: false, isInfoOpen: false, infoPresses: 0 };
    const runner = RunnerView({
        stage: document.createElement('div'),
        isOpen: () => true,
        isPlaying: () => state.isPlaying,
        isPaused: () => state.isPaused,
        onPausePressed: () => {
            state.isPaused = true;
        },
        onResumePressed: () => {
            state.isPaused = false;
        },
        isSoundOn: () => state.isSoundOn,
        isSoundOffByDefault: () => state.isSoundOffByDefault,
        onSoundPressed: () => {
            state.soundPresses++;
        },
        isPerfmonOpen: () => state.isPerfmonOpen,
        onPerfmonPressed: () => {
            state.perfmonPresses++;
        },
        musicVolume: () => 0.5,
        sfxVolume: () => 0.5,
        isInfoOpen: () => state.isInfoOpen,
        onInfoPressed: () => {
            state.infoPresses++;
        },
        title: () => 'Entry',
        isGame: () => true,
        isLandscape: () => false,
        isTurned: () => false,
    });
    document.body.replaceChildren(runner);
    refreshView(runner);
    return { runner, state };
}

function isHintShown(runner: Element): boolean {
    return !runner.querySelector('.runner-sound-hint')!.hasAttribute('hidden');
}
