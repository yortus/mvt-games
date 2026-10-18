/** @jsxImportSource @mvtjs/html */

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HelpButtonViewBindings {
    /** Whether the Help is open, which the button shows by lighting up. */
    readonly isOpen: () => boolean;
    readonly onPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The (i) at the end of the site's nav, which opens the playground's Help, and closes it. */
export function HelpButtonView(bindings: HelpButtonViewBindings): Element {
    return (
        <button
            type="button"
            class="help-button"
            aria-label="Help"
            title="How the playground works"
            aria-expanded={bindings.isOpen}
            onClick={() => bindings.onPressed?.()}
        />
    );
}
