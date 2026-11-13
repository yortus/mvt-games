import { describe, expect, it } from 'vitest';
import { findDayFrame } from './find-day-frame';
import { FRAME_KINDS } from './trace-frame';

describe('findDayFrame', () => {
    it('gives each frame once, in any run of days as long as the list of frames', () => {
        for (const start of [20_400, 20_401, 20_403]) {
            const frames = new Set<string>();
            for (let day = start; day < start + FRAME_KINDS.length; day++) frames.add(findDayFrame(day));
            expect(frames.size).toBe(FRAME_KINDS.length);
        }
    });

    it('gives the next day another frame, and the same frame again once every frame has had its day', () => {
        expect(findDayFrame(20_401)).not.toBe(findDayFrame(20_400));
        expect(findDayFrame(20_400 + FRAME_KINDS.length)).toBe(findDayFrame(20_400));
    });
});
