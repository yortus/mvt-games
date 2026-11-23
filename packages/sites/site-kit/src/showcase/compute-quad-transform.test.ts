import { describe, expect, it } from 'vitest';
import { computeQuadTransform } from './compute-quad-transform';

describe('computeQuadTransform', () => {
    it('lays each corner of the box on its corner of a shape seen in perspective', () => {
        // A box 400 by 300, onto a shape whose right edge is shorter, as a picture turned away to the right is
        const corners = [100, 50, 380, 90, 360, 260, 120, 330];
        const transform = computeQuadTransform({ width: 400, height: 300, corners });
        expect(transform).toBeDefined();
        const m = (transform ?? '').slice('matrix3d('.length, -1).split(',').map(Number);
        const boxCorners = [[0, 0], [400, 0], [400, 300], [0, 300]];
        const landed = boxCorners.flatMap(([x, y]) => {
            // As CSS applies it: a column-major matrix, then the divide by w
            const w = m[3] * x + m[7] * y + m[15];
            return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w];
        });
        for (let i = 0; i < corners.length; i++) expect(landed[i]).toBeCloseTo(corners[i], 6);
    });

    it('returns undefined for a flat shape', () => {
        expect(computeQuadTransform({ width: 400, height: 300, corners: [0, 0, 10, 10, 20, 20, 30, 30] })).toBeUndefined();
    });
});
