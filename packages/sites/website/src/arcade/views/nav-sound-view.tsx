/** @jsxImportSource @mvtjs/html */

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the nav's speaker shows, and what it reports. */
export interface NavSoundViewBindings {
    /** Whether any sound is on, the music or the effects, and not muted. */
    readonly isOn: () => boolean;
    /** Reported as the speaker is pressed. */
    readonly onPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows a speaker in the site's nav for all the sound, the music and the
 * effects, the Arcade's own and every entry's. The speaker is struck through
 * when all the sound is off or muted. The view reports a press, and the page
 * decides what it does.
 */
export function NavSoundView(bindings: NavSoundViewBindings): Element {
    return (
        <button
            type="button"
            class={() => (bindings.isOn() ? 'nav-sound' : 'nav-sound is-off')}
            aria-label="Sound"
            aria-pressed={() => (bindings.isOn() ? 'true' : 'false')}
            title={() => (bindings.isOn() ? 'Sound: on' : 'Sound: off')}
            onClick={() => bindings.onPressed?.()}
        />
    );
}
