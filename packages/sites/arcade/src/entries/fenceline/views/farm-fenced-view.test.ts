import { describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { FarmFencedView } from './farm-fenced-view';
import { FARM_LOOKS } from './view-constants';

const WIDTH = 480;
const HEIGHT = 336;
/** How close the text may come to the scene's sides: the text box's frame, and a little room. */
const MARGIN = 16;

describe('FarmFencedView', () => {
    it('fits every line of every farm\'s story inside the text box, with a margin', () => {
        for (let farm = 1; farm <= FARM_LOOKS.length; farm++) {
            const view = FarmFencedView({ width: WIDTH, height: HEIGHT, isShown: () => true, farm: () => farm, elapsedMs: () => 9000 });
            updateView(view, 0);
            refreshView(view);
            const lines = listLines(view);
            expect(lines.length).toBe(6);
            for (const line of lines) {
                const bounds = line.getBounds();
                expect(bounds.left, line.label).toBeGreaterThanOrEqual(MARGIN);
                expect(bounds.right, line.label).toBeLessThanOrEqual(WIDTH - MARGIN);
            }
            view.destroy({ children: true });
        }
    });

    it('types each line out a character at a time, keeping its place', () => {
        let elapsedMs = 800;
        const view = FarmFencedView({ width: WIDTH, height: HEIGHT, isShown: () => true, farm: () => 1, elapsedMs: () => elapsedMs });
        refreshView(view);
        expect(listLines(view).map((line) => line.label)).toContain('                              ');
        elapsedMs = 800 + 25 * 6;
        refreshView(view);
        expect(listLines(view).map((line) => line.label)).toContain('BREEZY                        ');
        elapsedMs = 2000;
        refreshView(view);
        expect(listLines(view).map((line) => line.label)).toContain('BREEZY ACRES IS ALL FENCED IN!');
        view.destroy({ children: true });
    });
});

/** The title and the story's lines, each labelled with what it spells. */
function listLines(view: Container): Container[] {
    const story = view.getChildByLabel('story', true);
    return story === null ? [] : story.children;
}
