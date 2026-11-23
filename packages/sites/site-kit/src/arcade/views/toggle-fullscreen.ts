// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Takes the page full screen, or back out of it if it is. The whole page
 * goes, not one element, so the nav and the runner's bar come too, with
 * their buttons for leaving. A browser that refuses, as it may without a
 * press to answer, leaves the page as it was.
 *
 * Only call it where `document.fullscreenEnabled` is true. Safari on an
 * iPhone, for one, only lets a video go full screen.
 */
export function toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
}
