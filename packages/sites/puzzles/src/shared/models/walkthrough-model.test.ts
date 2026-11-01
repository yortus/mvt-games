import { describe, expect, it } from 'vitest';
import { createWalkthroughModel, type Demo, type WalkthroughStep } from './walkthrough-model';

// A practice "puzzle" of two counts, and a walkthrough of three steps: raise the first, then the second, then nothing.

interface Practice {
    first: number;
    second: number;
}

const STEPS: readonly WalkthroughStep<Practice, number>[] = [
    { name: 'first', text: 'Raise the first.', isDone: (p) => p.first > 0, findDemo: (p) => [{ kind: 'tap', targets: [p.first] }] },
    { name: 'second', text: (demo) => `Raise the second, from ${demo[0].targets[0]}.`, isDone: (p) => p.second > 0, findDemo: (p) => [{ kind: 'tap', targets: [p.second] }] },
    { name: 'done', text: 'Done.', isDone: () => false, findDemo: () => [] as Demo<number> },
];

describe('WalkthroughModel', () => {
    it('waits at a step until the player has done what it asks, and stays at its last', () => {
        const { practice, walkthrough } = setUp();
        walkthrough.update(16);
        expect([walkthrough.stepName, walkthrough.stepNumber, walkthrough.stepCount]).toEqual(['first', 1, 3]);
        practice.first = 1;
        walkthrough.update(16);
        expect(walkthrough.stepName).toBe('second');
        practice.second = 1;
        walkthrough.update(16);
        walkthrough.update(16);
        expect([walkthrough.stepName, walkthrough.isAtLastStep]).toEqual(['done', true]);
    });

    it('moves on one step at each update, even when the player is ahead of it', () => {
        const { practice, walkthrough } = setUp();
        practice.first = 1;
        practice.second = 1;
        walkthrough.update(16);
        expect(walkthrough.stepName).toBe('second');
        walkthrough.update(16);
        expect(walkthrough.stepName).toBe('done');
    });

    it('finds the demo again only as the practice changes, and shows it anew only if it differs', () => {
        const { practice, walkthrough } = setUp();
        expect(walkthrough.demo).toEqual([{ kind: 'tap', targets: [0] }]);
        const shown = walkthrough.demosShown;
        walkthrough.update(16);
        expect(walkthrough.demosShown).toBe(shown);
        practice.first = -1;
        walkthrough.update(16);
        expect(walkthrough.demo).toEqual([{ kind: 'tap', targets: [-1] }]);
        expect(walkthrough.demosShown).toBe(shown + 1);
    });

    it('writes a step\'s text from its demo when the step asks', () => {
        const { practice, walkthrough } = setUp();
        practice.first = 1;
        practice.second = -4;
        walkthrough.update(16);
        expect(walkthrough.text).toBe('Raise the second, from -4.');
    });
});

function setUp() {
    const practice: Practice = { first: 0, second: 0 };
    const walkthrough = createWalkthroughModel({
        practice,
        steps: STEPS,
        findWhenChanged: [(p) => p.first, (p) => p.second],
        isSameTarget: (a, b) => a === b,
    });
    return { practice, walkthrough };
}
