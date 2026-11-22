import type { Container3D, Model3D } from '@pixi/3d';
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/utils';
import { jsx } from './jsx-runtime';
import { loadTestModel } from './test-model';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('<model>', () => {
    it('poses its clip at the time that a binding returns, and never plays it', async () => {
        const source = await loadTestModel();
        let timeMs = 500;
        const model = jsx('model', { source, clip: 'rise', clipTimeMs: () => timeMs }) as Model3D;
        const marker = findMarker(model);

        refreshView(model);
        expect(marker.y).toBeCloseTo(1);

        timeMs = 250;
        refreshView(model);
        expect(marker.y).toBeCloseTo(0.5);
        expect(model.player?.playing).toBe(false);
    });

    it('wraps a time past the clip\'s end, or holds the last pose when it doesn\'t loop', async () => {
        const source = await loadTestModel();
        const looping = jsx('model', { source, clip: 'rise', clipTimeMs: 1250 }) as Model3D;
        const holding = jsx('model', { source, clip: 'rise', clipTimeMs: 1250, clipLoops: false }) as Model3D;

        expect(findMarker(looping).y).toBeCloseTo(0.5);
        expect(findMarker(holding).y).toBeCloseTo(2);
    });

    it('requires a source, and reads it only when the model is made', async () => {
        const source = await loadTestModel();

        expect(() => jsx('model', {})).toThrow(/needs its 'source' attribute/);
        expect(() => jsx('model', { source: () => source })).toThrow(/takes a fixed value/);
    });
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function findMarker(model: Model3D): Container3D {
    const marker = model.getChildByLabel('marker', true);
    if (marker === null) throw new Error('The test model is missing its marker node');
    return marker;
}
