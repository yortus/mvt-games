/** @jsxImportSource @mvtjs/html */

import { toggleFullscreen } from './toggle-fullscreen';

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows a button in the site's nav that puts the page in full screen, and
 * back. The page shows it only while the showcase is on, and hides it while
 * the card wall shows, as it hides the magnifier the other way round. The
 * showcase fills the area under the nav. So on a phone held sideways, full
 * screen gets back the room the browser's own bars use.
 *
 * It doesn't need bindings, since what it does belongs to the browser,
 * not the page. Only make it where `document.fullscreenEnabled` is true.
 */
export function NavFullscreenView(): Element {
    return (
        <button
            type="button"
            class="nav-fullscreen"
            aria-label="Full screen"
            title="Full screen"
            onClick={toggleFullscreen}
        />
    );
}
