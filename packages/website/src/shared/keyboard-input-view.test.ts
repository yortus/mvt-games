// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { KeyboardInputView } from './keyboard-input-view';

describe('KeyboardInputView', () => {
    it('reports key events while an entry runs, and calls preventDefault on them', () => {
        const { view, state, press } = setUp();
        state.isActive = true;
        expect(press('ArrowLeft').defaultPrevented).toBe(true);
        expect(state.directions).toEqual(['left']);
        view.destroy();
    });

    it('ignores key events while no entry runs, so the rest of the page, such as a search box, gets them', () => {
        const { view, state, press } = setUp();
        state.isActive = false;
        expect(press('b').defaultPrevented).toBe(false);
        expect(press('ArrowLeft').defaultPrevented).toBe(false);
        expect(state.directions).toEqual([]);
        view.destroy();
    });

    it('releases keys held when an entry stops, so the next entry starts with none held', () => {
        const { view, state, press } = setUp();
        state.isActive = true;
        press('ArrowLeft');
        state.isActive = false;
        press('ArrowLeft', 'keyup');
        state.isActive = true;
        press('ArrowRight');
        // Left is reported released as soon as a key event finds the entry stopped. Releasing
        // right reports 'none': had left stayed held from the earlier entry, it would report 'left'
        press('ArrowRight', 'keyup');
        expect(state.directions).toEqual(['left', 'none', 'right', 'none']);
        view.destroy();
    });

    it('takes no key while the entry is held, and releases the buttons held as it was', () => {
        const { view, state, press } = setUp();
        state.isActive = true;
        press(' ');
        state.isActive = false;
        // Enter closes a menu over the entry: the entry must not see it as its restart button
        press('Enter');
        press(' ', 'keyup');
        state.isActive = true;
        press('Enter', 'keyup');
        expect(state.buttons).toEqual(['primary:true', 'primary:false', 'restart:false']);
        view.destroy();
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setUp() {
    const state = { isActive: false, directions: [] as string[], buttons: [] as string[] };
    const view = KeyboardInputView({
        isActive: () => state.isActive,
        onXDirectionChanged: (direction) => {
            state.directions.push(direction);
        },
        onPrimaryButtonChanged: (pressed) => {
            state.buttons.push(`primary:${pressed}`);
        },
        onRestartButtonChanged: (pressed) => {
            state.buttons.push(`restart:${pressed}`);
        },
    });
    /** Dispatches a key press or release on the page, as the browser would. */
    const press = (key: string, kind: 'keydown' | 'keyup' = 'keydown'): KeyboardEvent => {
        const event = new KeyboardEvent(kind, { key, bubbles: true, cancelable: true });
        document.body.dispatchEvent(event);
        return event;
    };
    return { view, state, press };
}
