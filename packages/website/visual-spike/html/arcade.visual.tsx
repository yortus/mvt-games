// Spike: some of the Arcade's HTML views, as the page styles them.
import { ENTRY_FACTS } from 'virtual:entry-facts';
import { refreshView } from '@mvtjs/html';
import { describe } from 'vitest';
import { findEntry } from '../../src/entries';
import { AboutView } from '../../src/arcade/views/about-view';
import { CardView } from '../../src/arcade/views/card-view';
import { EntryInfoView } from '../../src/arcade/views/entry-info-view';
import { PauseMenuView } from '../../src/arcade/views/pause-menu-view';
import '../../src/shared/nav.css';
import '../../src/arcade/arcade.css';
import { visualHtmlTest } from '../harness';

function inArcade(view: Element, width: number, height: number): HTMLElement {
    refreshView(view);
    const root = document.createElement('div');
    root.className = 'arcade';
    root.style.cssText = `position:relative;width:${width}px;height:${height}px;overflow:hidden;`;
    root.append(view);
    return root;
}

describe('arcade', () => {
    visualHtmlTest('card', async () => {
        const entry = findEntry('crumb-chase')!;
        const view = CardView({
            entry, x: () => 20, y: () => 20, width: () => 240, opacity: () => 1, isVisible: () => true,
            isLifted: () => false, isSelected: () => false, isTabStop: () => false, live: () => undefined, isLiveShowing: () => false,
        });
        const root = inArcade(view, 300, 340);
        // Card photos load lazily: load them now, and wait for them
        await Promise.all([...root.querySelectorAll('img')].map((img) => { img.loading = 'eager'; return img.decode().catch(() => undefined); }));
        return root;
    });
    visualHtmlTest('entry info', () => inArcade(EntryInfoView({
        entry: () => findEntry('fruit-machine'),
        factsFor: (id) => ENTRY_FACTS[id],
    }), 720, 640));
    visualHtmlTest('pause menu', () => inArcade(PauseMenuView({
        isOpen: () => true,
        instructions: () => 'Arrow keys to move. Space to fire.',
    }), 480, 400));
    visualHtmlTest('about note', () => inArcade(AboutView({ docsHref: './docs/', isOpen: () => true }), 520, 520));
});
