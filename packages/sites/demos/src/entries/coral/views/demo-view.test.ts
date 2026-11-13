import { describe, expect, it, vi } from 'vitest';
import type { Container, FederatedPointerEvent } from 'pixi.js';
import { updateView } from '@mvtjs/pixi';
import { createDemoModel } from '../models';
import { DemoView } from './demo-view';

describe('DemoView', () => {
    it('moves on to the next pattern on a double tap', () => {
        const { grid, view, nextPattern } = setUp();
        tap(grid, 10, 10);
        updateView(view, 100);
        tap(grid, 10, 10);
        expect(nextPattern).toHaveBeenCalledOnce();
    });

    it('counts no drag as a tap, so a drag then a tap is no double tap', () => {
        const { grid, view, nextPattern } = setUp();
        grid.emit('pointerdown', pointer(10, 10));
        grid.emit('globalpointermove', pointer(40, 10));
        grid.emit('pointerup', pointer(40, 10));
        updateView(view, 100);
        tap(grid, 40, 10);
        expect(nextPattern).not.toHaveBeenCalled();
    });

    it('counts two taps too far apart in time as no double tap', () => {
        const { grid, view, nextPattern } = setUp();
        tap(grid, 10, 10);
        updateView(view, 1000);
        tap(grid, 10, 10);
        expect(nextPattern).not.toHaveBeenCalled();
    });
});

function setUp(): { grid: Container; view: Container; nextPattern: ReturnType<typeof vi.fn> } {
    const model = createDemoModel();
    const nextPattern = vi.fn();
    model.nextPattern = nextPattern;
    const view = DemoView({ model });
    // The grid's sprite is the view's first child, under the caption
    return { grid: view.children[0], view, nextPattern };
}

function tap(grid: Container, x: number, y: number): void {
    grid.emit('pointerdown', pointer(x, y));
    grid.emit('pointerup', pointer(x, y));
}

/** The first finger at (x, y), in the grid's cells. */
function pointer(x: number, y: number): FederatedPointerEvent {
    return { pointerId: 1, getLocalPosition: (_target: unknown, point: { x: number; y: number }) => Object.assign(point, { x, y }) } as unknown as FederatedPointerEvent;
}
