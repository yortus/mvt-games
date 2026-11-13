import { describe, expect, it } from 'vitest';
import { Container, type FederatedPointerEvent } from 'pixi.js';
import { listenToPress, type Press, type PressOptions } from './listen-to-press';

describe('listenToPress', () => {
    it('fires as the pointer lets go over the button, not as it goes down', () => {
        const { target, presses } = listen();
        target.emit('pointerdown', pointer(1));
        expect(presses()).toBe(0);
        target.emit('pointerup', pointer(1));
        expect(presses()).toBe(1);
        expect(target.eventMode).toBe('static');
    });

    it('doesn\'t fire for a pointer let go off the button, or cancelled', () => {
        const { target, presses } = listen();
        target.emit('pointerdown', pointer(1));
        target.emit('pointerupoutside', pointer(1));
        target.emit('pointerdown', pointer(1));
        target.emit('pointercancel', pointer(1));
        expect(presses()).toBe(0);
    });

    it('shows a hold while the pointer is down and over the button', () => {
        const { target, press } = listen();
        expect(press.isHeld).toBe(false);
        target.emit('pointerdown', pointer(1));
        expect(press.isHeld).toBe(true);
        target.emit('pointerout', pointer(1));
        expect(press.isHeld).toBe(false);
        target.emit('pointerover', pointer(1));
        expect(press.isHeld).toBe(true);
        target.emit('pointerup', pointer(1));
        expect(press.isHeld).toBe(false);
    });

    it('ignores a second finger while it follows the first', () => {
        const { target, press, presses } = listen();
        target.emit('pointerdown', pointer(1));
        target.emit('pointerdown', pointer(2));
        target.emit('pointerout', pointer(2));
        target.emit('pointerup', pointer(2));
        expect([presses(), press.isHeld]).toEqual([0, true]);
        target.emit('pointerup', pointer(1));
        expect(presses()).toBe(1);
    });

    it('reads whether the button works as the pointer lets go', () => {
        let isEnabled = true;
        const { target, presses } = listen({ isEnabled: () => isEnabled });
        target.emit('pointerdown', pointer(1));
        isEnabled = false;
        target.emit('pointerup', pointer(1));
        expect(presses()).toBe(0);
    });
});

function listen(more: Partial<PressOptions> = {}): { target: Container; press: Press; presses: () => number } {
    const target = new Container();
    let presses = 0;
    const press = listenToPress({ target, onPressed: () => presses++, ...more });
    return { target, press, presses: () => presses };
}

/** A pointer event from finger `pointerId`. */
function pointer(pointerId: number): FederatedPointerEvent {
    return { pointerId } as unknown as FederatedPointerEvent;
}
