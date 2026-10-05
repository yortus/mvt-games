/** @jsxImportSource @mvtjs/html */
import type { ArcadeModel } from '../models';
import { AboutView } from './about-view';
import { SearchBarView } from './search-bar-view';
import { WordmarkView } from './wordmark-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ArcadeHeadViewBindings {
    /** The arcade, whose search the head shows. */
    readonly model: ArcadeModel;
    /** Whether the wall is what the visitor is looking at: only then does `/` jump to the search. */
    readonly isActive: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The head of the arcade's page, on one line: its name as a marquee, the (i)
 * that opens a note about it, and the search. When the search wraps under
 * the name, the name stands centred over it: where it wraps depends on the
 * name's width and the search's, not on a screen width, so the view measures
 * it as the head's size changes, and keeps the answer as its own state.
 */
export function ArcadeHeadView(bindings: ArcadeHeadViewBindings): Element {
    const { model } = bindings;
    let title: HTMLElement | undefined;
    const search = SearchBarView({
        chips: model.chips,
        activeChipAt: model.activeChipAt,
        chipCountAt: model.chipCountAt,
        isChipOfferedAt: model.isChipOfferedAt,
        activeCount: () => model.activeChipCount,
        text: () => model.searchText,
        isActive: bindings.isActive,
        onTextChanged: (text) => { model.searchText = text; },
        onChipChosen: model.chooseChipAt,
        onChipRemoved: model.removeChipAt,
        onClearPressed: model.clearSearch,
    });
    let isStacked = false;
    const observer = new ResizeObserver(() => {
        if (title === undefined || !(search instanceof HTMLElement)) return;
        isStacked = search.offsetTop > title.offsetTop + title.offsetHeight / 2;
    });

    return (
        <header
            class={() => (isStacked ? 'arcade-head is-stacked' : 'arcade-head')}
            ref={(e) => observer.observe(e)}
            onDestroyed={() => observer.disconnect()}
        >
            <div class="arcade-title" ref={(e) => { title = e; }}>
                <h1 class="arcade-name">{WordmarkView({ text: 'MVT ARCADE', label: 'MVT Arcade' })}</h1>
                <AboutView docsHref="../docs/" />
            </div>
            {search}
        </header>
    );
}
