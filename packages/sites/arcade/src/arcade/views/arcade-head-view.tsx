/** @jsxImportSource @mvtjs/html */
import type { ArcadeModel } from '../models';
import { SearchBarView } from './search-bar-view';
import { WordmarkView } from './wordmark-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ArcadeHeadViewBindings {
    /** The arcade, whose search the head shows. */
    readonly model: ArcadeModel;
    /** Whether the search box shows. It slides open and shut, so the wall under it moves rather than jumps. */
    readonly isSearchShown: () => boolean;
    /** Counts the times the caret was asked for in the search box. Each rise puts it there, once the box shows. */
    readonly searchFocusRequests: () => number;
    /** Reported as the focus leaves the search box. */
    readonly onSearchLeft?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The head of the arcade's page, on one line: its name as a marquee, and the
 * search, when it shows. When the search wraps under the name, the name
 * stands centred over it: where it wraps depends on the name's width and the
 * search's, not on a screen width, so the view measures it as the head's
 * size changes, and keeps the answer as its own state.
 *
 * The search shows while it is open, or while it holds something. It slides
 * open and shut, so the wall under it moves down and back up rather than
 * jumping. Asked for the caret, the view puts it in the box once the box
 * shows, which may be a frame or two after.
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
        onTextChanged: (text) => { model.searchText = text; },
        onChipChosen: model.chooseChipAt,
        onChipRemoved: model.removeChipAt,
        onClearPressed: model.clearSearch,
        onLeft: () => bindings.onSearchLeft?.(),
    });
    let focusedFor = bindings.searchFocusRequests();
    let isStacked = false;
    let slot: HTMLElement | undefined;
    const observer = new ResizeObserver(() => {
        if (title === undefined || slot === undefined) return;
        isStacked = slot.offsetTop > title.offsetTop + title.offsetHeight / 2;
    });

    return (
        <header
            class={() => (isStacked ? 'arcade-head is-stacked' : 'arcade-head')}
            ref={(e) => observer.observe(e)}
            onRefresh={focusWhenAsked}
            onDestroyed={() => observer.disconnect()}
        >
            <div class="arcade-title" ref={(e) => { title = e; }}>
                <h1 class="arcade-name">{WordmarkView({ text: 'ARCADE', label: 'Arcade' })}</h1>
            </div>
            {/* Shut, it takes no room, and nothing in it takes the focus */}
            <div
                class={() => (bindings.isSearchShown() ? 'search-slot is-open' : 'search-slot')}
                ref={(e) => { slot = e; }}
                onRefresh={(e) => {
                    const isShut = !bindings.isSearchShown();
                    if (e.inert !== isShut) e.inert = isShut;
                }}
            >
                <div class="search-slot-clip">{search}</div>
            </div>
        </header>
    );

    /**
     * Puts the caret in the search box once it has been asked for. The box
     * may still be shut in the frame it is asked for, and a shut box takes no
     * focus, so it tries again each frame until the caret is there.
     */
    function focusWhenAsked(): void {
        const requests = bindings.searchFocusRequests();
        if (requests === focusedFor || !(search instanceof HTMLElement)) return;
        const input = search.querySelector<HTMLInputElement>('.search-input');
        input?.focus({ preventScroll: true });
        if (input !== null && document.activeElement === input) focusedFor = requests;
    }
}
