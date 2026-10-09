// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/html';
import { PauseMenuView } from './pause-menu-view';

describe('PauseMenuView', () => {
    it('opens on its menu, and shows how to play on its other tab', () => {
        const { menu, state } = setUp();
        expect(isShown(menu, '#pause-page-menu')).toBe(true);
        expect(isShown(menu, '#pause-page-how-to-play')).toBe(false);
        click(menu, '#pause-tab-how-to-play');
        refreshView(menu);
        expect(isShown(menu, '#pause-page-menu')).toBe(false);
        expect(isShown(menu, '#pause-page-how-to-play')).toBe(true);
        expect(menu.querySelector('.pause-how-to pre')?.textContent).toBe(state.instructions);
        expect(menu.querySelector('#pause-tab-how-to-play')?.getAttribute('aria-selected')).toBe('true');
    });

    it('puts only the tab that shows in the tab order', () => {
        const { menu } = setUp();
        expect(menu.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Pause menu pages');
        expect(tabIndexOf(menu, '#pause-tab-menu')).toBe(0);
        expect(tabIndexOf(menu, '#pause-tab-how-to-play')).toBe(-1);
        click(menu, '#pause-tab-how-to-play');
        refreshView(menu);
        expect(tabIndexOf(menu, '#pause-tab-menu')).toBe(-1);
        expect(tabIndexOf(menu, '#pause-tab-how-to-play')).toBe(0);
    });

    it('opens on its menu again, whichever tab it closed on', () => {
        const { menu, state } = setUp();
        click(menu, '#pause-tab-how-to-play');
        tick(menu);
        state.isOpen = false;
        tick(menu);
        state.isOpen = true;
        tick(menu);
        expect(isShown(menu, '#pause-page-menu')).toBe(true);
    });

    it('says so when an entry has no instructions', () => {
        const { menu, state } = setUp();
        state.instructions = undefined;
        click(menu, '#pause-tab-how-to-play');
        refreshView(menu);
        expect(menu.querySelector('.pause-how-to pre')?.textContent).not.toBe('');
    });

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

    it('goes down from Restart through the two sliders to Exit', () => {
        const { menu } = setUp();
        focus(menu, '.pause-restart');
        const visited: (string | undefined)[] = [];
        for (let i = 0; i < 3; i++) {
            press('ArrowDown');
            visited.push(document.activeElement?.id || document.activeElement?.className);
        }
        expect(visited).toEqual(['pause-music-volume', 'pause-effects-volume', 'pause-exit']);
    });

    it('goes up from Resume round to Exit, skipping the tabs, so Up then Enter leaves', () => {
        const { menu } = setUp();
        focus(menu, '.pause-resume');
        press('ArrowUp');
        expect(document.activeElement?.classList.contains('pause-exit')).toBe(true);
        press('ArrowDown');
        expect(document.activeElement?.classList.contains('pause-resume')).toBe(true);
    });

    it('restarts with R and leaves with X, from either tab, once for a key held down', () => {
        const { menu, reports } = setUp();
        press('r');
        press('r', { repeat: true });
        expect(reports.restarts).toBe(1);
        click(menu, '#pause-tab-how-to-play');
        refreshView(menu);
        press('X');
        expect(reports.exits).toBe(1);
    });

    it('listens to no keys while closed', () => {
        const { state, reports } = setUp();
        state.isOpen = false;
        press('x');
        expect(reports.exits).toBe(0);
    });

    it('switches tabs with left and right, except on a slider', () => {
        const { menu } = setUp();
        focus(menu, '#pause-music-volume');
        press('ArrowRight');
        refreshView(menu);
        expect(isShown(menu, '#pause-page-menu')).toBe(true);
        focus(menu, '.pause-restart');
        press('ArrowRight');
        refreshView(menu);
        expect(isShown(menu, '#pause-page-how-to-play')).toBe(true);
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
        instructions: 'Shoot everything.' as string | undefined,
        musicVolume: 0.5,
        effectsVolume: 0.5,
    };
    const reports = { musicVolume: -1, effectsIconPresses: 0, restarts: 0, exits: 0 };
    const menu = PauseMenuView({
        isOpen: () => state.isOpen,
        instructions: () => state.instructions,
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

/** Ticks the menu as the page does, updating it and then refreshing it. */
function tick(menu: Element): void {
    updateView(menu, 16);
    refreshView(menu);
}

function tabIndexOf(root: Element, selector: string): number | undefined {
    return root.querySelector<HTMLElement>(selector)?.tabIndex;
}

function isShown(root: Element, selector: string): boolean {
    const element = root.querySelector(selector);
    return element !== null && !element.hasAttribute('hidden');
}

function click(root: Element, selector: string): void {
    root.querySelector<HTMLElement>(selector)?.click();
}

function focus(root: Element, selector: string): void {
    root.querySelector<HTMLElement>(selector)?.focus();
}

/** Presses a key where the focus is, as the browser sends it. The key bubbles up to the window, where the menu listens. */
function press(key: string, options: { repeat?: boolean } = {}): void {
    const target = document.activeElement ?? document.body;
    target.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: options.repeat ?? false, bubbles: true, cancelable: true }));
}
