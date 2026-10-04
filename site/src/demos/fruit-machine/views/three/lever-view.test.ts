import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/three';
import { LeverView } from './lever-view';
import { createMaterialKit } from './material-kit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
    let spinCount = 0;
    const lever = LeverView({ kit: createMaterialKit(), spinCount: () => spinCount });
    const frame = (deltaMs: number): void => {
        updateView(lever, deltaMs);
        refreshView(lever);
    };
    frame(0);
    return {
        angle: () => lever.rotation.x,
        frame,
        spin: () => { spinCount++; },
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Runs in Node: the view needs no WebGL, only the renderer that draws it does.
describe('LeverView', () => {
    it('rests upright', () => {
        const t = setup();
        const rest = t.angle();

        t.frame(1000);

        expect(t.angle()).toBe(rest);
    });

    it('swings down and back each time a spin starts, wherever it was started', () => {
        const t = setup();
        const rest = t.angle();

        t.spin();
        t.frame(16);
        t.frame(180);
        expect(t.angle()).toBeGreaterThan(rest + 1);

        for (let i = 0; i < 40; i++) t.frame(16);
        expect(t.angle()).toBeCloseTo(rest);
    });
});
