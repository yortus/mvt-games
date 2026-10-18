import type { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/pixi';
import { OverlayView } from './overlay-view';

describe('OverlayView', () => {
    function createOverlay(): { view: Container; backdrop: Container; presses: () => number } {
        let presses = 0;
        const view = OverlayView({
            width: 200,
            height: 100,
            isVisible: () => true,
            text: () => 'GAME OVER',
            onPressed: () => {
                presses++;
            },
        });
        refreshView(view);
        return { view, backdrop: view.children[0], presses: () => presses };
    }

    it('relays a press at once, and nothing as it is let go', () => {
        const { backdrop, presses } = createOverlay();
        backdrop.emit('pointerdown', {} as never);
        expect(presses()).toBe(1);
        backdrop.emit('pointerup', {} as never);
        expect(presses()).toBe(1);
    });

    it('relays each press', () => {
        const { backdrop, presses } = createOverlay();
        backdrop.emit('pointerdown', {} as never);
        backdrop.emit('pointerup', {} as never);
        backdrop.emit('pointerdown', {} as never);
        expect(presses()).toBe(2);
    });

    it('is not interactive without a relay binding', () => {
        const view = OverlayView({ width: 200, height: 100, isVisible: () => true, text: () => '' });
        expect(view.children[0].eventMode).not.toBe('static');
    });
});
