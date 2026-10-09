// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/html';
import { NavSoundView } from './nav-sound-view';

describe('NavSoundView', () => {
    it('shows whether any sound is on, and reports a press', () => {
        const state = { isOn: true, presses: 0 };
        const button = NavSoundView({
            isOn: () => state.isOn,
            onPressed: () => {
                state.presses++;
            },
        }) as HTMLButtonElement;
        refreshView(button);
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.classList.contains('is-off')).toBe(false);

        state.isOn = false;
        refreshView(button);
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.classList.contains('is-off')).toBe(true);

        button.click();
        expect(state.presses).toBe(1);
    });
});
