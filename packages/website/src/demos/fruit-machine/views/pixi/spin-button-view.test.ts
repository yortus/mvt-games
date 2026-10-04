import { type Container, Text } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/pixi';
import { type SpinButtonMode, SpinButtonView } from './spin-button-view';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(initialMode: SpinButtonMode) {
    let mode = initialMode;
    let presses = 0;
    const view = SpinButtonView({
        mode: () => mode,
        radius: 50,
        onPressed: () => {
            presses++;
        },
    });
    refreshView(view);
    const label = (): string => findText(view)?.text ?? '';
    const press = (): void => {
        view.emit('pointertap', undefined as never);
    };
    return {
        view,
        label,
        press,
        presses: () => presses,
        setMode: (next: SpinButtonMode) => {
            mode = next;
            refreshView(view);
        },
    };
}

function findText(container: Container): Text | undefined {
    for (const child of container.children) {
        if (child instanceof Text) return child;
        const found = findText(child);
        if (found) return found;
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpinButtonView', () => {
    it('says what pressing it would do', () => {
        const t = setup('spin');
        expect(t.label()).toBe('SPIN');

        t.setMode('stop');
        expect(t.label()).toBe('STOP');

        t.setMode('skip');
        expect(t.label()).toBe('SKIP');
    });

    it('reports a press while enabled', () => {
        const t = setup('spin');

        t.press();

        expect(t.presses()).toBe(1);
    });

    it('ignores a press while disabled', () => {
        const t = setup('disabled');

        t.press();

        expect(t.presses()).toBe(0);
    });
});
