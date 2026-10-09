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

function setUp(): { runner: Element; state: { isPlaying: boolean; isSoundOn: boolean; isSoundOffByDefault: boolean; soundPresses: number } } {
    const state = { isPlaying: true, isSoundOn: true, isSoundOffByDefault: false, soundPresses: 0 };
    const runner = RunnerView({
        stage: document.createElement('div'),
        isOpen: () => true,
        isPlaying: () => state.isPlaying,
        isPaused: () => false,
        isSoundOn: () => state.isSoundOn,
        isSoundOffByDefault: () => state.isSoundOffByDefault,
        onSoundPressed: () => {
            state.soundPresses++;
        },
        musicVolume: () => 0.5,
        effectsVolume: () => 0.5,
        title: () => 'Entry',
        instructions: () => undefined,
        isLandscape: () => false,
    });
    document.body.replaceChildren(runner);
    refreshView(runner);
    return { runner, state };
}

function isHintShown(runner: Element): boolean {
    return !runner.querySelector('.runner-sound-hint')!.hasAttribute('hidden');
}
