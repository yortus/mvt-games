import type { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { tickScene } from '@mvtjs/pixi';
import { OverlayView } from './overlay-view';

describe('OverlayView', () => {
    function createOverlay(): { view: Container; backdrop: Container; relayed: boolean[] } {
        const relayed: boolean[] = [];
        const view = OverlayView({
            width: 200,
            height: 100,
            isVisible: () => true,
            text: () => 'GAME OVER',
            onRestartPressed: (pressed) => relayed.push(pressed),
        });
        tickScene({ root: view, only: 'refresh' });
        return { view, backdrop: view.children[0], relayed };
    }

    it('relays a press at once', () => {
        const { backdrop, relayed } = createOverlay();
        backdrop.emit('pointerdown', {} as never);
        expect(relayed).toEqual([true]);
    });

    it('holds a release back until its next update', () => {
        const { view, backdrop, relayed } = createOverlay();
        backdrop.emit('pointerdown', {} as never);
        backdrop.emit('pointerup', {} as never);
        expect(relayed).toEqual([true]);

        tickScene({ root: view, deltaMs: 16, only: 'update' });
        expect(relayed).toEqual([true, false]);

        tickScene({ root: view, deltaMs: 16, only: 'update' });
        expect(relayed).toEqual([true, false]);
    });

    it('drops a pending release when pressed again first', () => {
        const { view, backdrop, relayed } = createOverlay();
        backdrop.emit('pointerdown', {} as never);
        backdrop.emit('pointerup', {} as never);
        backdrop.emit('pointerdown', {} as never);

        tickScene({ root: view, deltaMs: 16, only: 'update' });
        expect(relayed).toEqual([true, true]);
    });

    it('is not interactive without a relay binding', () => {
        const view = OverlayView({ width: 200, height: 100, isVisible: () => true, text: () => '' });
        expect(view.children[0].eventMode).not.toBe('static');
    });
});
