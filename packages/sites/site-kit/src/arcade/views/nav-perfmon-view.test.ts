// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/html';
import { NavPerfmonView } from './nav-perfmon-view';

describe('NavPerfmonView', () => {
    it('shows whether the Perfmon is open, and reports a press', () => {
        const state = { isOpen: false, presses: 0 };
        const button = NavPerfmonView({
            isOpen: () => state.isOpen,
            onPressed: () => {
                state.presses++;
            },
        }) as HTMLButtonElement;
        refreshView(button);
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.classList.contains('is-on')).toBe(false);

        state.isOpen = true;
        refreshView(button);
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.classList.contains('is-on')).toBe(true);

        button.click();
        expect(state.presses).toBe(1);
    });
});
