// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { ARCADE_CONTROL_KEYS } from './arcade-control-keys';
import { type ArcadeControls, createArcadeControls } from './arcade-controls';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let controls: ArcadeControls | undefined;

afterEach(() => {
    controls?.destroy();
    controls = undefined;
    document.body.replaceChildren();
});

/** Creates the arcade controls on the arcade's keys, and keeps everything they report, in order. */
function setup(isActive: () => boolean = () => true) {
    const reports: string[] = [];
    controls = createArcadeControls({ keys: ARCADE_CONTROL_KEYS, isActive });
    controls.listen({
        onXDirectionChanged: (direction) => reports.push(`x ${direction}`),
        onYDirectionChanged: (direction) => reports.push(`y ${direction}`),
        onPrimaryButtonChanged: (pressed) => reports.push(`primary ${pressed}`),
        onSecondaryButtonChanged: (pressed) => reports.push(`secondary ${pressed}`),
        onRestartButtonChanged: (pressed) => reports.push(`restart ${pressed}`),
    });
    return { controls, reports };
}

/** Sends a key event to the window, and returns it. */
function send(kind: 'keydown' | 'keyup', key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent(kind, { key, bubbles: true, cancelable: true, ...init });
    window.dispatchEvent(event);
    return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createArcadeControls', () => {
    it('reports each control held from the keys in its table', () => {
        const { reports } = setup();
        for (const key of ['ArrowLeft', 'w', ' ', 'Shift', 'Enter']) send('keydown', key);
        expect(reports).toEqual(['x left', 'y up', 'primary true', 'secondary true', 'restart true']);
    });

    it('reports a button as it goes down and up, and not again while its key repeats', () => {
        const { reports } = setup();
        send('keydown', ' ');
        send('keydown', ' ', { repeat: true });
        send('keyup', ' ');
        expect(reports).toEqual(['primary true', 'primary false']);
    });

    it('turns to the way pressed last, and back to the other as it is let go', () => {
        const { reports } = setup();
        send('keydown', 'ArrowLeft');
        send('keydown', 'd');
        send('keyup', 'd');
        send('keyup', 'ArrowLeft');
        expect(reports).toEqual(['x left', 'x right', 'x left', 'x none']);
    });

    it('keeps a way held while either of its keys is', () => {
        const { reports } = setup();
        send('keydown', 'ArrowUp');
        send('keydown', 'w');
        send('keyup', 'ArrowUp');
        expect(reports).toEqual(['y up']);
    });

    it('releases a letter pressed before Shift and released after it, though Shift makes it a capital', () => {
        const { reports } = setup();
        send('keydown', 'w');
        send('keydown', 'Shift', { shiftKey: true });
        send('keyup', 'W', { shiftKey: true });
        send('keyup', 'Shift');
        expect(reports).toEqual(['y up', 'secondary true', 'y none', 'secondary false']);
    });

    it('handles the letters with Caps Lock on', () => {
        const { reports } = setup();
        send('keydown', 'A');
        expect(reports).toEqual(['x left']);
    });

    it('releases every key held as the window loses focus', () => {
        const { reports } = setup();
        send('keydown', 'ArrowRight');
        send('keydown', ' ');
        window.dispatchEvent(new Event('blur'));
        expect(reports).toEqual(['x right', 'primary true', 'x none', 'primary false']);
    });

    it('prevents the default action of its own keys only', () => {
        setup();
        expect(send('keydown', 'ArrowLeft').defaultPrevented).toBe(true);
        expect(send('keydown', 'Tab').defaultPrevented).toBe(false);
        expect(send('keydown', 'q').defaultPrevented).toBe(false);
    });

    it('ignores a key pressed during a pause, and releases none held into it', () => {
        let isPaused = false;
        const { reports } = setup(() => !isPaused);
        send('keydown', 'Shift');
        isPaused = true;
        send('keydown', ' ');
        send('keydown', 'Escape');
        expect(reports).toEqual(['secondary true']);
    });

    it('reports a key released during a pause, as it is released', () => {
        let isPaused = false;
        const { reports } = setup(() => !isPaused);
        send('keydown', 'Shift');
        isPaused = true;
        send('keyup', 'Shift');
        expect(reports).toEqual(['secondary true', 'secondary false']);
    });

    it('keeps a control held while it is held from the keys or the touch controls', () => {
        const { controls, reports } = setup();
        send('keydown', ' ');
        controls.setHeld('touch', 'primary', true);
        send('keyup', ' ');
        expect(controls.isHeld('primary')).toBe(true);
        controls.setHeld('touch', 'primary', false);
        expect(reports).toEqual(['primary true', 'primary false']);
    });

    it('turns straight from one way to the other as a d-pad does, without stopping between', () => {
        const { controls, reports } = setup();
        controls.setXDirection('touch', 'left');
        controls.setXDirection('touch', 'right');
        controls.setXDirection('touch', 'none');
        controls.setYDirection('touch', 'down');
        expect(reports).toEqual(['x left', 'x right', 'x none', 'y down']);
        expect([controls.xDirection, controls.yDirection]).toEqual(['none', 'down']);
    });

    it('reports nothing to a listener as it starts, even for a control already held', async () => {
        const { controls } = setup();
        send('keydown', 'ArrowLeft');
        const late: string[] = [];
        controls.listen({ onXDirectionChanged: (direction) => late.push(direction) });
        await Promise.resolve();
        expect(late).toEqual([]);
        send('keyup', 'ArrowLeft');
        expect(late).toEqual(['none']);
    });

    it('reports nothing once destroyed, not even the keys it releases', async () => {
        const { controls, reports } = setup();
        send('keydown', 'ArrowLeft');
        controls.destroy();
        await Promise.resolve();
        send('keydown', ' ');
        expect(reports).toEqual(['x left']);
    });
});
