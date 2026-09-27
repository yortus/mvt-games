import { describe, expect, it } from 'vitest';
import { addReads, countReads, readCounter } from './read-counter';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('read counter', () => {
    it('counts the reads added while measuring', () => {
        expect(countReads(() => {
            addReads(3);
            addReads(4);
        })).toBe(7);
    });

    it('ignores reads added while not measuring', () => {
        const before = readCounter.count;

        addReads(5);

        expect(readCounter.isCounting).toBe(false);
        expect(readCounter.count).toBe(before);
    });

    it('restores the previous on/off state after counting', () => {
        readCounter.isCounting = true;
        try {
            countReads(() => undefined);
            expect(readCounter.isCounting).toBe(true);
        }
        finally {
            readCounter.isCounting = false;
        }
    });

    it('counts a nested measurement in the outer one too', () => {
        let inner = 0;
        const outer = countReads(() => {
            addReads(2);
            inner = countReads(() => addReads(3));
        });

        expect(inner).toBe(3);
        expect(outer).toBe(5);
    });
});
