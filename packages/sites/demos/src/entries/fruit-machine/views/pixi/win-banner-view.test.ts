import { describe, expect, it } from 'vitest';
import type { Container, Text } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { WinBannerView } from './win-banner-view';

const BIG_WIN = 1250;
const SMALL_WIN = 10;

describe('WinBannerView', () => {
    it('counts nothing up on a step of no time', () => {
        const { view, shownText, win } = setUp();
        const before = shownText();
        win(BIG_WIN);
        updateView(view, 0);
        updateView(view, 0);
        refreshView(view);
        expect(shownText()).toBe(before);
    });

    it('counts a small win up at the same pace at any frame rate', () => {
        const fast = setUp();
        const slow = setUp();
        fast.win(SMALL_WIN);
        slow.win(SMALL_WIN);
        // 64 ms, in frames of 8 and of 32
        for (let i = 0; i < 8; i++) updateView(fast.view, 8);
        for (let i = 0; i < 2; i++) updateView(slow.view, 32);
        refreshView(fast.view);
        refreshView(slow.view);
        expect(fast.shownText()).toBe(slow.shownText());
    });
});

function setUp() {
    let amount = 0;
    const view = WinBannerView({ isShown: () => true, amount: () => amount, caption: () => '' });
    refreshView(view);
    const shownText = (): string => ((view as Container).children[1] as Text).text;
    const win = (next: number): void => {
        amount = next;
    };
    return { view, shownText, win };
}
