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
        // Releasing right reports 'none'. Had left stayed held from the earlier entry, it would report 'left'
        press('ArrowRight', 'keyup');
        expect(state.directions).toEqual(['left', 'right', 'none']);
        view.destroy();
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setUp() {
    const state = { isActive: false, directions: [] as string[] };
    const view = KeyboardInputView({
        isActive: () => state.isActive,
        onXDirectionChanged: (direction) => {
            state.directions.push(direction);
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
