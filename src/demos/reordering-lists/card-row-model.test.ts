import { describe, expect, it } from 'vitest';
import { createCardRowModel, type CardRowModel } from './card-row-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEP_MS = 1500;

function arrayLabels(model: CardRowModel): string {
    let labels = '';
    for (let i = 0; i < model.cardArray.length; i++) labels += model.cardArray[i].label;
    return labels;
}

function orderedLabels(model: CardRowModel): string {
    let labels = '';
    const ordered = model.cardSlots.ordered;
    for (let i = 0; i < ordered.length; i++) labels += ordered.at(i)!.value.label;
    return labels;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('card row model', () => {
    it('starts populated, before the first frame', () => {
        const model = createCardRowModel();

        expect(arrayLabels(model)).toBe('ABCDE');
        expect(orderedLabels(model)).toBe('ABCDE');
    });

    it('keeps both forms in the same order through every step of the script, twice', () => {
        const model = createCardRowModel();
        const seen: string[] = [];

        for (let i = 0; i < 14; i++) {
            model.update(STEP_MS);
            expect(orderedLabels(model)).toBe(arrayLabels(model));
            seen.push(arrayLabels(model));
        }

        expect(seen.slice(0, 7)).toEqual(['EDCBA', 'AEDCB', 'AEXDCB', 'AEXCB', 'EXCB', 'EXCBY', 'ABCDE']);
        expect(seen.slice(7)).toEqual(seen.slice(0, 7));
    });

    it('keeps a removed card in its slot, no longer live, until the release delay passes', () => {
        const model = createCardRowModel();
        model.update(STEP_MS * 4); // sort, move, insert X, remove the middle card (D)

        const slots = model.cardSlots.slots;
        let pending = 0;
        for (let i = 0; i < slots.length; i++) {
            const slot = slots.at(i);
            if (slot !== undefined && !slot.isLive) pending += 1;
        }
        expect(pending).toBe(1);
        expect(model.cardSlots.liveCount).toBe(model.cardArray.length);

        model.update(1000);
        for (let i = 0; i < slots.length; i++) expect(slots.at(i)?.isLive ?? true).toBe(true);
    });

    it('moves a tapped card to the front of both forms', () => {
        const model = createCardRowModel();

        model.moveToFront(model.cardArray[3]);

        expect(arrayLabels(model)).toBe('DABCE');
        expect(orderedLabels(model)).toBe('DABCE');
        expect(model.caption).toBe('move D -> front');
    });
});
