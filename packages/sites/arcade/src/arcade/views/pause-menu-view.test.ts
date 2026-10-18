// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/html';
import { PauseMenuView } from './pause-menu-view';

describe('PauseMenuView', () => {
    it('shows each volume as a step from 0 to 10, its icon crossed out at 0', () => {
        const { menu, state } = setUp();
        const [music, effects] = [...menu.querySelectorAll('.sound-control')];
        const slider = music.querySelector<HTMLInputElement>('input')!;
        expect(slider.valueAsNumber).toBe(Math.round(state.musicVolume * Number(slider.max)));
        expect(music.classList.contains('is-off')).toBe(false);
        state.effectsVolume = 0;
        refreshView(menu);
        expect(effects.classList.contains('is-off')).toBe(true);
        expect(effects.querySelector('input')?.getAttribute('aria-valuetext')).toBe('Off');
    });

    it('reports a press of a sound\'s icon, or of Enter on its slider', () => {
        const { menu, reports } = setUp();
        const effects = menu.querySelectorAll('.sound-control')[1];
        effects.querySelector<HTMLElement>('.sound-control-toggle')?.click();
        expect(reports.effectsIconPresses).toBe(1);
        effects.querySelector<HTMLElement>('input')?.focus();
        press('Enter');
        press('Enter', { repeat: true });
        expect(reports.effectsIconPresses).toBe(2);
    });

    it('says what pressing a sound\'s icon does, and leaves the icon out of the tab order', () => {
        const { menu, state } = setUp();
        const toggle = menu.querySelector<HTMLElement>('.sound-control-toggle')!;
        expect(toggle.tagName).toBe('BUTTON');
        expect(toggle.tabIndex).toBe(-1);
        expect(toggle.getAttribute('aria-label')).toBe('Turn the music off');
        state.musicVolume = 0;
        refreshView(menu);
        expect(toggle.getAttribute('aria-label')).toBe('Turn the music on');
    });

    it('names each slider for assistive technology, though only its icon shows', () => {
        const { menu } = setUp();
        const names = ['#pause-music-volume', '#pause-effects-volume'].map((id) => menu.querySelector(`label[for="${id.slice(1)}"]`)?.textContent);
        expect(names).toEqual(['Music', 'Effects']);
        expect(menu.querySelector('.sound-control-icon')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('reports a step moved to as a volume in tenths', () => {
        const { menu, reports } = setUp();
        const music = menu.querySelector<HTMLInputElement>('#pause-music-volume');
        const steps = Number(music!.max);
        const step = 3;
        music!.valueAsNumber = step;
        music!.dispatchEvent(new Event('input'));
        expect(reports.musicVolume).toBeCloseTo(step / steps, 9);
    });

    it('heads the menu with its heading, in the pixel font', () => {
        const { menu } = setUp();
        expect(menu.querySelector('#pause-title svg')?.getAttribute('aria-label')).toBe('GAME PAUSED');
    });

    it('goes down from the row of choices through the two sliders, and round to Resume', () => {
        const { menu } = setUp();
        focus(menu, '.pause-restart');
        const visited: (string | undefined)[] = [];
        for (let i = 0; i < 3; i++) {
            press('ArrowDown');
            visited.push(document.activeElement?.id || document.activeElement?.className);
        }
        expect(visited).toEqual(['pause-music-volume', 'pause-effects-volume', 'pause-resume']);
    });

    it('moves along the row with left and right, round, so Left then Enter leaves', () => {
        const { menu } = setUp();
        focus(menu, '.pause-resume');
        press('ArrowLeft');
        expect(document.activeElement?.classList.contains('pause-exit')).toBe(true);
        press('d');
        expect(document.activeElement?.classList.contains('pause-resume')).toBe(true);
        press('ArrowRight');
        expect(document.activeElement?.classList.contains('pause-restart')).toBe(true);
    });

    it('leaves left and right to a slider, which they move', () => {
        const { menu } = setUp();
        focus(menu, '#pause-music-volume');
        press('ArrowLeft');
        expect(document.activeElement?.id).toBe('pause-music-volume');
    });

    it('restarts with R and leaves with X, wherever the focus is, once for a key held down', () => {
        const { menu, reports } = setUp();
        press('r');
        press('r', { repeat: true });
        expect(reports.restarts).toBe(1);
        focus(menu, '#pause-music-volume');
        press('X');
        expect(reports.exits).toBe(1);
    });

    it('listens to no keys while closed', () => {
        const { state, reports } = setUp();
        state.isOpen = false;
        press('x');
        expect(reports.exits).toBe(0);
    });

    it('shows each choice the key that presses it', () => {
        const { menu } = setUp();
        const keys = [...menu.querySelectorAll('.pause-page button')]
            .filter((button) => button.hasAttribute('aria-keyshortcuts'))
            .map((button) => [button.getAttribute('aria-keyshortcuts'), button.querySelector('.pause-key')?.textContent]);
        expect(keys).toEqual([['Escape', 'Esc'], ['R', 'R'], ['X', 'X']]);
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
    const reports = { musicVolume: -1, effectsIconPresses: 0, restarts: 0, exits: 0 };
    const menu = PauseMenuView({
        isOpen: () => state.isOpen,
        heading: () => 'GAME PAUSED',
        musicVolume: () => state.musicVolume,
        effectsVolume: () => state.effectsVolume,
        onMusicVolumeChanged: (volume) => { reports.musicVolume = volume; },
        onEffectsIconPressed: () => { reports.effectsIconPresses++; },
        onRestartPressed: () => { reports.restarts++; },
        onExitPressed: () => { reports.exits++; },
    });
    document.body.replaceChildren(menu);
    refreshView(menu);
    return { menu, state, reports };
}

function focus(root: Element, selector: string): void {
    root.querySelector<HTMLElement>(selector)?.focus();
}

/** Presses a key where the focus is, as the browser sends it. The key bubbles up to the window, where the menu listens. */
function press(key: string, options: { repeat?: boolean } = {}): void {
    const target = document.activeElement ?? document.body;
    target.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: options.repeat ?? false, bubbles: true, cancelable: true }));
}
