import { describe, expect, it } from 'vitest';
import { createAttractViewModel } from './attract-view-model';

const DELAY_MS = 1000;

describe('attract mode', () => {
    function setup() {
        let candidate = -1;
        const attract = createAttractViewModel({ candidate: () => candidate, delayMs: DELAY_MS });
        return {
            attract,
            choose: (index: number) => { candidate = index; },
            /** Advances `ms` in frame-sized steps. */
            advance: (ms: number) => {
                for (let t = 0; t < ms; t += 16) attract.update(Math.min(16, ms - t));
            },
        };
    }

    it('plays nothing at first', () => {
        const { attract } = setup();
        expect(attract.index).toBe(-1);
    });

    it('plays a card once it has stayed the candidate for the delay, and not before', () => {
        const { attract, choose, advance } = setup();
        choose(3);
        attract.update(16);
        advance(DELAY_MS - 50);
        expect(attract.index).toBe(-1);
        advance(100);
        expect(attract.index).toBe(3);
    });

    it('stops at once when the candidate moves on, and the next card waits its own turn', () => {
        const { attract, choose, advance } = setup();
        choose(3);
        attract.update(16);
        advance(DELAY_MS + 100);
        choose(5);
        attract.update(16);
        expect(attract.index).toBe(-1);
        advance(DELAY_MS - 50);
        expect(attract.index).toBe(-1);
        advance(100);
        expect(attract.index).toBe(5);
    });

    it('stops when there is no candidate, as when previews are not allowed', () => {
        const { attract, choose, advance } = setup();
        choose(2);
        attract.update(16);
        advance(DELAY_MS + 100);
        choose(-1);
        attract.update(16);
        expect(attract.index).toBe(-1);
        advance(DELAY_MS * 3);
        expect(attract.index).toBe(-1);
    });

    it('starts the wait again for a card that comes back', () => {
        const { attract, choose, advance } = setup();
        choose(2);
        attract.update(16);
        advance(DELAY_MS / 2);
        choose(4);
        attract.update(16);
        choose(2);
        attract.update(16);
        advance(DELAY_MS / 2 + 50);
        expect(attract.index).toBe(-1);
    });
});
