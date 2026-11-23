import { describe, expect, it } from 'vitest';
import { toDayNumber } from '../../shared';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../data';
import { createPaperLayout, type PageRect, type PaperLayout } from './paper-layout';

const ASPECTS = [540 / 768, 540 / 768, 3 / 4, 1, 540 / 768, 540 / 768];
const DAY = toDayNumber({ year: 2026, month: 11, day: 21 });

describe('a day\'s paper', () => {
    it('is the same all day, and laid out afresh the next day', () => {
        expect(createPaperLayout({ day: DAY, puzzleAspects: ASPECTS })).toEqual(createPaperLayout({ day: DAY, puzzleAspects: ASPECTS }));
        expect(createPaperLayout({ day: DAY + 1, puzzleAspects: ASPECTS })).not.toEqual(createPaperLayout({ day: DAY, puzzleAspects: ASPECTS }));
    });

    it('puts every puzzle on a spread of its own, between the front page and the back page', () => {
        for (const layout of sampleDays()) {
            const puzzles = layout.spreads.map((spread) => spread.puzzleIndex);
            expect(puzzles[0]).toBeUndefined();
            expect(puzzles.at(-1)).toBeUndefined();
            expect(puzzles.slice(1, -1).sort()).toEqual(ASPECTS.map((_, index) => index));
            expect(layout.pages.length).toBe(layout.spreads.length * 2 - 2);
        }
    });

    it('prints each puzzle\'s box on its own spread, in its play area\'s shape, inside the page', () => {
        const misfits: string[] = [];
        for (const layout of sampleDays()) {
            for (let s = 1; s < layout.spreads.length - 1; s++) {
                const { puzzleIndex, puzzlePage, puzzleBox } = layout.spreads[s];
                if (puzzleIndex === undefined || puzzlePage === undefined || puzzleBox === undefined) continue;
                const shape = (puzzleBox.width * PAGE_WIDTH) / (puzzleBox.height * PAGE_HEIGHT);
                const isOnSpread = puzzlePage === s * 2 - 1 || puzzlePage === s * 2;
                if (!isOnSpread || Math.abs(shape - ASPECTS[puzzleIndex]) > 1e-9 || !isInsidePage(puzzleBox)) misfits.push(`${layout.day}: spread ${s}`);
            }
        }
        expect(misfits).toEqual([]);
    });

    it('keeps every block inside its page, clear of the others', () => {
        const overlaps: string[] = [];
        for (const layout of sampleDays()) {
            for (const page of layout.pages) {
                const { blocks } = page;
                for (let i = 0; i < blocks.length; i++) {
                    if (!isInsidePage(blocks[i])) overlaps.push(`${layout.day}: page ${page.number}, block ${i} spills off`);
                    for (let j = i + 1; j < blocks.length; j++) {
                        if (doOverlap(blocks[i], blocks[j])) overlaps.push(`${layout.day}: page ${page.number}, blocks ${i} and ${j}`);
                    }
                }
            }
        }
        expect(overlaps).toEqual([]);
    });

    it('gives every spread two or three headlines a reader can read, never the same one twice in the paper', () => {
        for (const layout of sampleDays()) {
            const all: string[] = [];
            for (let s = 1; s < layout.spreads.length - 1; s++) {
                const headlines = [...layout.pages[s * 2 - 1].blocks, ...layout.pages[s * 2].blocks].flatMap((block) => (block.headline === undefined ? [] : [block.headline]));
                expect(headlines.length).toBeGreaterThanOrEqual(2);
                expect(headlines.length).toBeLessThanOrEqual(3);
                all.push(...headlines);
            }
            expect(new Set(all).size).toBe(all.length);
        }
    });
});

function sampleDays(): PaperLayout[] {
    const layouts: PaperLayout[] = [];
    for (let i = 0; i < 40; i++) layouts.push(createPaperLayout({ day: DAY + i * 3, puzzleAspects: ASPECTS }));
    return layouts;
}

function isInsidePage(rect: PageRect): boolean {
    return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 1 + 1e-9 && rect.y + rect.height <= 1 + 1e-9;
}

function doOverlap(a: PageRect, b: PageRect): boolean {
    const gap = 1e-9;
    return a.x + a.width > b.x + gap && b.x + b.width > a.x + gap && a.y + a.height > b.y + gap && b.y + b.height > a.y + gap;
}
