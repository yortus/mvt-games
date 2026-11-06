import { describe, expect, it, vi } from 'vitest';
import { createRepeater } from './repeater';

const PERIOD_MS = 200;

describe('createRepeater', () => {
    it('calls at once as it starts, then once a period', () => {
        const onRepeat = vi.fn();
        const repeater = createRepeater({ periodMs: () => PERIOD_MS, onRepeat });
        repeater.update(1);
        expect(onRepeat).toHaveBeenCalledTimes(1);
        repeater.update(PERIOD_MS - 1);
        expect(onRepeat).toHaveBeenCalledTimes(1);
        repeater.update(1);
        expect(onRepeat).toHaveBeenCalledTimes(2);
    });

    it('makes no calls while its period is 0, less than 0, or NaN', () => {
        const periods = [0, -PERIOD_MS, Number.NaN];
        for (let i = 0; i < periods.length; i++) {
            const onRepeat = vi.fn();
            const repeater = createRepeater({ periodMs: () => periods[i], onRepeat });
            repeater.update(PERIOD_MS);
            expect(onRepeat).not.toHaveBeenCalled();
        }
    });

    it('calls at once again after it is turned off and on', () => {
        const onRepeat = vi.fn();
        let periodMs = PERIOD_MS;
        const repeater = createRepeater({ periodMs: () => periodMs, onRepeat });
        repeater.update(1);
        periodMs = 0;
        repeater.update(PERIOD_MS * 3);
        expect(onRepeat).toHaveBeenCalledTimes(1);
        periodMs = PERIOD_MS;
        repeater.update(1);
        expect(onRepeat).toHaveBeenCalledTimes(2);
    });

    it('calls once for each period that passes in one step', () => {
        const onRepeat = vi.fn();
        const repeater = createRepeater({ periodMs: () => PERIOD_MS, onRepeat });
        repeater.update(1);
        repeater.update(PERIOD_MS * 3);
        expect(onRepeat).toHaveBeenCalledTimes(1 + 3);
    });

    it('reads its period on every update, so the rate can change', () => {
        const onRepeat = vi.fn();
        let periodMs = PERIOD_MS;
        const repeater = createRepeater({ periodMs: () => periodMs, onRepeat });
        repeater.update(1);
        periodMs = PERIOD_MS / 2;
        repeater.update(PERIOD_MS / 2);
        expect(onRepeat).toHaveBeenCalledTimes(2);
    });
});
