/** @jsxImportSource @mvtjs/html */
import { memoiseLast } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface NavSearchViewBindings {
    /** The page's own search, or what holds it: the button shows once none of it is in view below the site's nav. */
    readonly search: Element;
    /** Whether the page is where the search is used (the wall, with nothing over it): the button shows only then. */
    readonly isActive: () => boolean;
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
 * the wall, which nothing else in view would say down there. Whether the
 * search is in view is this view's own state, from an `IntersectionObserver`
 * on it, so the view must be destroyed (`destroyElement`) to let it go.
 */
export function NavSearchView(bindings: NavSearchViewBindings): Element {
    const label = memoiseLast((shown: number) => (shown < bindings.totalCount
        ? `Search (showing ${shown} of ${bindings.totalCount})`
        : 'Search'));
    // Presentation state: whether any of the search shows below the site's nav
    let isSearchInView = true;
    const observer = new IntersectionObserver(
        (records) => { isSearchInView = records[records.length - 1].isIntersecting; },
        { rootMargin: `-${navHeight()}px 0px 0px 0px` },
    );
    observer.observe(bindings.search);

    return (
        <button
            type="button"
            class={buttonClass}
            aria-label={() => label(bindings.shownCount())}
            title={() => label(bindings.shownCount())}
            onClick={() => bindings.onPressed?.()}
            onDestroyed={() => observer.disconnect()}
        />
    );

    function buttonClass(): string {
        const isShown = !isSearchInView && bindings.isActive();
        const isNarrowed = bindings.shownCount() < bindings.totalCount;
        if (!isShown) return isNarrowed ? 'nav-search is-narrowed' : 'nav-search';
        return isNarrowed ? 'nav-search is-shown is-narrowed' : 'nav-search is-shown';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The height of the site's fixed nav, which covers the top of the page: the search is out of view once under it. */
function navHeight(): number {
    const height = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--site-nav-height'));
    return Number.isNaN(height) ? 0 : height;
}
