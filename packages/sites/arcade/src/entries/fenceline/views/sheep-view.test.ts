import { describe, expect, it } from 'vitest';
import { type Container, Graphics, Text } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import type { SheepPhase } from '../models';
import { SheepView } from './sheep-view';

const STEP_MS = 1000 / 60;

function makeSheep(phase: SheepPhase): { view: Container; state: { phase: SheepPhase } } {
    const state = { phase };
    const view = SheepView({
        row: () => 10.5,
        col: () => 10.5,
        cellSize: 8,
        spriteScale: 1,
        phase: () => state.phase,
        isFacingLeft: () => false,
        penPoints: 500,
    });
    return { view, state };
}

function run(view: Container, ms: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
        updateView(view, STEP_MS);
        refreshView(view);
    }
}

/** The text of every visible text object in the view, and every visible label, which is how pixel text tells what it spells, if the view itself shows. */
function listShownTexts(view: Container): string[] {
    const texts: string[] = [];
    walk(view);
    return texts;

    function walk(node: Container): void {
        if (!node.visible || node.alpha === 0) return;
        if (node instanceof Text) texts.push(node.text);
        // A Graphics is labelled with its kind, so only other labels are text
        else if (!(node instanceof Graphics) && typeof node.label === 'string' && node.label !== '') texts.push(node.label);
        for (const child of node.children) walk(child);
    }
}

describe('SheepView', () => {
    it('shows its points rising from it as it is penned, then fades them', () => {
        const { view, state } = makeSheep('grazing');
        run(view, 500);
        expect(listShownTexts(view)).toEqual([]);
        state.phase = 'penned';
        run(view, 300);
        expect(listShownTexts(view)).toEqual(['+500']);
        run(view, 1500);
        expect(listShownTexts(view)).toEqual([]);
    });

    it('cheers only as a sheep becomes penned, not for one penned already', () => {
        const { view } = makeSheep('penned');
        run(view, 300);
        expect(listShownTexts(view)).toEqual([]);
    });
});
