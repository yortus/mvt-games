// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshView, updateView } from '@mvtjs/html';
import type { ArcadeEntry, EntryDetails, EntryStarter } from '../../entry-types';
import type { HighscoreRow } from '../../highscores';
import { EntryInfoView } from './entry-info-view';

describe('EntryInfoView', () => {
    it('opens on Description, and shows how to play on its own tab', () => {
        const { panel, state } = setUp();
        expect(isPageShown(panel, 'description')).toBe(true);
        expect(isPageShown(panel, 'how-to-play')).toBe(false);
        click(panel, '#info-tab-how-to-play');
        refreshView(panel);
        expect(isPageShown(panel, 'description')).toBe(false);
        expect(panel.querySelector('.how-intro')?.textContent).toBe(state.details.howToPlay?.intro);
        expect(panel.querySelector('#info-tab-how-to-play')?.getAttribute('aria-selected')).toBe('true');
    });

    it('has a tab only for what the entry has, and no tabs at all for Description alone', () => {
        const { panel, state } = setUp();
        expect(isShown(panel, '#info-tab-highscores')).toBe(false);
        state.entry = { ...ENTRY, hasHighscores: true };
        refreshView(panel);
        expect(isShown(panel, '#info-tab-highscores')).toBe(true);
        state.entry = ENTRY;
        state.details = { description: 'Only words.' };
        refreshView(panel);
        expect(isShown(panel, '.info-tabs')).toBe(false);
    });

    it('puts only the tab that shows in the tab order, and moves between tabs with left and right, round', () => {
        const { panel, state } = setUp();
        state.entry = { ...ENTRY, hasHighscores: true };
        refreshView(panel);
        expect(tabIndexOf(panel, '#info-tab-description')).toBe(0);
        expect(tabIndexOf(panel, '#info-tab-how-to-play')).toBe(-1);
        panel.querySelector<HTMLElement>('#info-tab-description')!.focus();
        press('ArrowLeft');
        refreshView(panel);
        expect(isPageShown(panel, 'highscores')).toBe(true);
        expect(tabIndexOf(panel, '#info-tab-highscores')).toBe(0);
        press('ArrowRight');
        press('ArrowRight');
        refreshView(panel);
        expect(isPageShown(panel, 'how-to-play')).toBe(true);
        expect(document.activeElement?.id).toBe('info-tab-how-to-play');
    });

    it('opens on How to Play over the entry, with Resume in place of Play', () => {
        const { panel, state } = setUp({ isOpen: false });
        state.isOverEntry = true;
        state.isOpen = true;
        tick(panel);
        expect(isPageShown(panel, 'how-to-play')).toBe(true);
        expect(panel.querySelector('.info-play')?.textContent).toBe('Resume');
    });

    it('starts on its first tab again for another entry, or as it opens again', () => {
        const { panel, state } = setUp();
        click(panel, '#info-tab-how-to-play');
        tick(panel);
        state.isOpen = false;
        tick(panel);
        state.isOpen = true;
        tick(panel);
        expect(isPageShown(panel, 'description')).toBe(true);
    });

    it('shows one page at a time', () => {
        const { panel } = setUp();
        const pages = [...panel.querySelectorAll('.info-page')];
        expect(pages.every((page) => !page.hasAttribute('hidden'))).toBe(true);
        expect(pages.filter((page) => page.classList.contains('is-shown'))).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STARTER: EntryStarter = { kind: 'element', start: notStarted };

const ENTRY: ArcadeEntry = {
    id: 'a-game',
    name: 'A Game',
    tags: { kind: 'game', era: '1980s', genres: ['maze'] },
    summary: 'A maze.',
    loadDetails: () => Promise.resolve({ description: '' }),
    screenWidth: 100,
    screenHeight: 100,
    thumbnail: '',
    load: () => Promise.resolve(STARTER),
};

function setUp(initial: { isOpen?: boolean } = {}) {
    const state = {
        isOpen: initial.isOpen ?? true,
        entry: ENTRY,
        details: { description: 'A maze game.', howToPlay: { intro: 'Eat every dot.' } } as EntryDetails,
        isOverEntry: false,
        rows: [] as readonly HighscoreRow[],
    };
    const panel = EntryInfoView({
        entry: () => (state.isOpen ? state.entry : undefined),
        details: () => state.details,
        factsFor: () => undefined,
        highscoreRowsFor: () => state.rows,
        highscoresStatus: () => 'ready',
        isOverEntry: () => state.isOverEntry,
    });
    document.body.replaceChildren(panel);
    tick(panel);
    return { panel, state };
}

/** Ticks the panel as the page does, updating it and then refreshing it. */
function tick(panel: Element): void {
    updateView(panel, 16);
    refreshView(panel);
}

function isShown(root: Element, selector: string): boolean {
    const element = root.querySelector(selector);
    return element !== null && !element.hasAttribute('hidden');
}

/** Whether a page is the one that shows. */
function isPageShown(root: Element, kind: string): boolean {
    const page = root.querySelector(`#info-page-${kind}`);
    return page !== null && !page.hasAttribute('hidden') && page.classList.contains('is-shown');
}

function tabIndexOf(root: Element, selector: string): number | undefined {
    return root.querySelector<HTMLElement>(selector)?.tabIndex;
}

function click(root: Element, selector: string): void {
    root.querySelector<HTMLElement>(selector)?.click();
}

/** Presses a key where the focus is, as the browser sends it. */
function press(key: string): void {
    const target = document.activeElement ?? document.body;
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function notStarted(): never {
    throw new Error('not started in these tests');
}
