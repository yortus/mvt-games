// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { listenToKeys } from './listen-to-keys';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let stopListening = (): void => {};

afterEach(() => {
    stopListening();
    document.body.replaceChildren();
});

function setup(isActive = true) {
    const calls: string[] = [];
    const held: boolean[] = [];
    stopListening = listenToKeys({
        isActive: () => isActive,
        pressed: { 'c': () => calls.push('c'), 'C': () => calls.push('capital c'), 'x': () => calls.push('x'), ' ': () => calls.push('space') },
        repeating: { ',': () => calls.push('comma') },
        held: { ArrowLeft: 'left', a: 'left', ArrowRight: 'right' },
        onHeldChanged: (isHeld) => held.push(isHeld('left')),
    });
    return { calls, held };
}

/** Sends a key event from `target`, and returns it. */
function send(kind: string, key: string, target: EventTarget = window, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent(kind, { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('listenToKeys', () => {
    it('reports a press once, and takes the key from the page', () => {
        const { calls } = setup();
        const event = send('keydown', 'c');
        send('keydown', 'c', window, { repeat: true });
        expect(calls).toEqual(['c']);
        expect(event.defaultPrevented).toBe(true);
    });

    it('reports a repeating key each time it repeats', () => {
        const { calls } = setup();
        send('keydown', ',');
        send('keydown', ',', window, { repeat: true });
        expect(calls).toEqual(['comma', 'comma']);
    });

    it('prefers a capital listed for itself, and otherwise takes it as the lower case', () => {
        const { calls } = setup();
        send('keydown', 'C');
        send('keydown', 'X');
        expect(calls).toEqual(['capital c', 'x']);
    });

    it('leaves other keys alone', () => {
        setup();
        expect(send('keydown', 'Tab').defaultPrevented).toBe(false);
    });

    it('reports a hold as it starts and ends, however the key repeats', () => {
        const { held } = setup();
        send('keydown', 'ArrowLeft');
        send('keydown', 'ArrowLeft', window, { repeat: true });
        send('keyup', 'ArrowLeft');
        expect(held).toEqual([true, false]);
    });

    it('keeps a hold while any of its keys is down', () => {
        const { held } = setup();
        send('keydown', 'ArrowLeft');
        send('keydown', 'a');
        send('keyup', 'ArrowLeft');
        expect(held).toEqual([true]);
        send('keyup', 'a');
        expect(held).toEqual([true, false]);
    });

    it('lets a letter go whichever case it comes up in', () => {
        const { held } = setup();
        send('keydown', 'A');
        send('keyup', 'a');
        expect(held).toEqual([true, false]);
    });

    it('lets go of everything as the window loses focus', () => {
        const { held } = setup();
        send('keydown', 'a');
        window.dispatchEvent(new Event('blur'));
        expect(held).toEqual([true, false]);
    });

    it('takes no keys while it isn\'t active', () => {
        const { calls, held } = setup(false);
        send('keydown', 'c');
        send('keydown', 'a');
        expect(calls).toEqual([]);
        expect(held).toEqual([]);
    });

    it('leaves its arrows to a focused slider, and its other keys still work', () => {
        const { calls, held } = setup();
        const slider = document.createElement('input');
        slider.type = 'range';
        document.body.append(slider);
        expect(send('keydown', 'ArrowLeft', slider).defaultPrevented).toBe(false);
        send('keydown', 'c', slider);
        expect(held).toEqual([]);
        expect(calls).toEqual(['c']);
    });

    it('leaves Space to a focused button', () => {
        const { calls } = setup();
        const button = document.createElement('button');
        document.body.append(button);
        send('keydown', ' ', button);
        expect(calls).toEqual([]);
    });

    it('stops reporting once it stops listening', () => {
        const { calls } = setup();
        stopListening();
        send('keydown', 'c');
        expect(calls).toEqual([]);
    });

    it('releases what is held as it stops, once the code running has finished, so it can stop during a frame', async () => {
        const { held } = setup();
        send('keydown', 'a');
        stopListening();
        expect(held).toEqual([true]);
        await Promise.resolve();
        expect(held).toEqual([true, false]);
    });

    it('still counts a key released while it isn\'t active, so none stays held', () => {
        let isActive = true;
        const held: boolean[] = [];
        stopListening = listenToKeys({
            isActive: () => isActive,
            pressed: {},
            repeating: {},
            held: { a: 'left' },
            onHeldChanged: (isHeld) => held.push(isHeld('left')),
        });
        send('keydown', 'a');
        isActive = false;
        send('keyup', 'a');
        expect(held).toEqual([true, false]);
    });
});
