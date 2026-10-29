import { describe, expect, it } from 'vitest';
import { encodeWav, toInt16 } from './encode-wav';

describe('encodeWav', () => {
    it('encodes a WAV file with two channels, a frame at a time, the left first', () => {
        const left = Float32Array.of(0.5, -0.5);
        const right = Float32Array.of(0.25, 1);
        const view = new DataView(encodeWav({ left, right }, 32000).buffer);
        // The channel count, the bytes a second, the bytes a frame and the data's length
        expect([view.getUint16(22, true), view.getUint32(28, true), view.getUint16(32, true), view.getUint32(40, true)]).toEqual([2, 128000, 4, 8]);
        expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true), view.getInt16(50, true)]).toEqual([toInt16(0.5), toInt16(0.25), toInt16(-0.5), toInt16(1)]);
    });
});
