/** @jsxImportSource @mvtjs/html */
import { memoiseLast } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface NavSearchViewBindings {
    /** Whether the button shows: while the page's own search is out of view. */
    readonly isShown: () => boolean;
    /** How many entries the search shows, of how many there are: a search that narrows the wall is marked. */
    readonly shownCount: () => number;
    readonly totalCount: number;
    readonly onPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A magnifier in the site's nav, for a visitor scrolled down the wall: it
 * takes them back to the search. A dot on it says the search is narrowing
 * the wall, which nothing else in view would say down there.
 */
export function NavSearchView(bindings: NavSearchViewBindings): Element {
    const label = memoiseLast((shown: number) => (shown < bindings.totalCount
        ? `Search (showing ${shown} of ${bindings.totalCount})`
        : 'Search'));

    return (
        <button
            type="button"
            class={buttonClass}
            aria-label={() => label(bindings.shownCount())}
            title={() => label(bindings.shownCount())}
            onClick={() => bindings.onPressed?.()}
        />
    );

    function buttonClass(): string {
        const isNarrowed = bindings.shownCount() < bindings.totalCount;
        if (!bindings.isShown()) return isNarrowed ? 'nav-search is-narrowed' : 'nav-search';
        return isNarrowed ? 'nav-search is-shown is-narrowed' : 'nav-search is-shown';
    }
}
