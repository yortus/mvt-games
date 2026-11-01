import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@mvtjs/site-kit/storage';
import { createDailyRecords } from './daily-records';
import { createIntroModel } from './intro-model';

describe('IntroModel', () => {
    it('shows the card the first time, and not again by itself once put away, on this visit or the next', () => {
        const store = createMemoryStore();
        const intro = createTestIntro(store);
        expect(intro.phase).toBe('hidden');
        intro.showCardIfNew();
        expect(intro.phase).toBe('card');
        intro.close();
        expect(intro.phase).toBe('hidden');
        intro.showCardIfNew();
        expect(intro.phase).toBe('hidden');
        const next = createTestIntro(store);
        next.showCardIfNew();
        expect(next.phase).toBe('hidden');
        // It still shows when asked
        next.showCard();
        expect(next.phase).toBe('card');
    });

    it('starts a walkthrough on a new practice puzzle from the card, and drops it as it ends', () => {
        const intro = createTestIntro(createMemoryStore());
        intro.startWalkthrough();
        expect(intro.phase).toBe('hidden');
        intro.showCard();
        intro.startWalkthrough();
        expect(intro.phase).toBe('walkthrough');
        const practice = intro.practice;
        expect(practice).toEqual({ count: 0 });
        expect(intro.walkthrough?.stepName).toBe('only');
        expect(intro.practiceChanges).toBe(1);
        intro.close();
        expect([intro.phase, intro.practice, intro.walkthrough, intro.practiceChanges]).toEqual(['hidden', undefined, undefined, 2]);
        intro.showCard();
        intro.startWalkthrough();
        expect(intro.practice).not.toBe(practice);
    });

    it('goes back to the card from a walkthrough, when asked, dropping the practice puzzle', () => {
        const intro = createTestIntro(createMemoryStore());
        intro.showCard();
        intro.startWalkthrough();
        intro.showCard();
        expect([intro.phase, intro.practice]).toEqual(['card', undefined]);
    });
});

function createTestIntro(store = createMemoryStore()) {
    const records = createDailyRecords({ store, gameId: 'test', levels: ['easy'] });
    return createIntroModel({
        records,
        createPractice: () => ({ count: 0 }),
        steps: [{ name: 'only', text: 'Done.', isDone: () => false, findDemo: () => [] }],
        findWhenChanged: [(practice) => practice.count],
        isSameTarget: (a: number, b: number) => a === b,
    });
}
