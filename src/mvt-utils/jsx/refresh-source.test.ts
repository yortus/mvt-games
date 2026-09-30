import { describe, expect, it } from 'vitest';
import { REFRESH_SOURCE_VERSION, refreshFactorySource, refreshShapeKey, type ShapeBinding } from './refresh-source';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('refresh source', () => {
    // Precompiled factories carry the version they were made with, and a
    // runtime ignores any other. This test pins what version 1 produces for a
    // shape using every write kind, so that changing either output fails here
    // until REFRESH_SOURCE_VERSION is bumped, and the expectations with it.
    it('produces, for this version, exactly the pinned key and source', () => {
        const bindings: ShapeBinding[] = [
            { key: 'visible', kind: 'every-frame', property: 'visible' },
            { key: 'x', kind: 'every-frame', property: 'x' },
            { key: 'scale', kind: 'every-frame', property: undefined },
            { key: 'texture', kind: 'on-change', property: 'texture' },
            { key: 'width', kind: 'on-change-number', property: 'width' },
        ];

        expect(REFRESH_SOURCE_VERSION).toBe(1);
        expect(refreshShapeKey(true, bindings)).toBe('v|e.visible,e.x,e@scale,c.texture,n.width,');
        expect(refreshFactorySource(true, bindings)).toEqual({
            params: ['e', 's', 'u', 'c', 'g0', 'a0', 'g1', 'a1', 'g2', 'a2', 'g3', 'a3', 'g4', 'a4'],
            body: 'var v3=u;var n=new Float64Array(1).fill(NaN);return function(){'
                + 'if(c.isCounting)c.count++;var _0=g0();e.visible=_0;if(!_0)return s;if(c.isCounting)c.count+=4;'
                + 'e.x=g1();a2(e,g2());var _3=g3();if(_3!==v3){v3=_3;e.texture=_3;}'
                + 'var _4=g4();if(_4!==n[0]){n[0]=_4;e.width=_4;}};',
        });
    });

    it('keys a shape without visible apart from one with it', () => {
        const bindings: ShapeBinding[] = [{ key: 'x', kind: 'every-frame', property: 'x' }];

        expect(refreshShapeKey(false, bindings)).toBe('|e.x,');
        expect(refreshShapeKey(true, bindings)).toBe('v|e.x,');
    });
});
