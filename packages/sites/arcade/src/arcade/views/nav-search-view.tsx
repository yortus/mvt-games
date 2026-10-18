/** @jsxImportSource @mvtjs/html */
import { memoiseLast } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface NavSearchViewBindings {
    /** Whether the search box shows, in the Arcade's head: the magnifier is lit while it does. */
    readonly isOn: () => boolean;
    /** How many entries the search shows, of how many there are: a search that narrows the wall is marked. */
    readonly shownCount: () => number;
    readonly totalCount: number;
    readonly onPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A magnifier in the site's nav, always there, which opens the search, or
 * closes it while it is empty. It is lit while the search box shows, and a
 * dot on it says the search is narrowing the wall, which a visitor scrolled
 * down the wall would not otherwise see.
 *
 * A press on it leaves the focus where it was: in the search box, it would
 * otherwise leave the box, which closes an empty one before the press could.
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
            aria-pressed={() => (bindings.isOn() ? 'true' : 'false')}
            title={() => label(bindings.shownCount())}
            ref={(e) => e.addEventListener('mousedown', (event) => event.preventDefault())}
            onClick={() => bindings.onPressed?.()}
        />
    );

    function buttonClass(): string {
        const isNarrowed = bindings.shownCount() < bindings.totalCount;
        if (bindings.isOn()) return isNarrowed ? 'nav-search is-on is-narrowed' : 'nav-search is-on';
        return isNarrowed ? 'nav-search is-narrowed' : 'nav-search';
    }
}
