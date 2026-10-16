import { describe, expect, it } from 'vitest';
import { createHeadlessAudio80 } from './headless-audio80';
import { renderTicks } from './render';

describe('renderTicks', () => {
    for (const tickMs of [0, -1, NaN]) {
        it(`refuses a tick of ${tickMs} ms, which would never reach the end`, () => {
            expect(() => renderTicks(createHeadlessAudio80({ render: true }), 100, tickMs, () => undefined)).toThrow('tickMs must be positive');
        });
    }
});
