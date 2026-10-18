/** @jsxImportSource @mvtjs/html */

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the nav's gauge shows, and what it reports. */
export interface NavPerfmonViewBindings {
    /** Whether the Perfmon is open. */
    readonly isOpen: () => boolean;
    /** Reported as the gauge is pressed. */
    readonly onPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows a gauge in the site's nav, which opens and closes the Perfmon: a
 * panel of how fast the page runs. The gauge is lit while the Perfmon is
 * open. The view reports a press, and the page decides what it does.
 */
export function NavPerfmonView(bindings: NavPerfmonViewBindings): Element {
    return (
        <button
            type="button"
            class={() => (bindings.isOpen() ? 'nav-perfmon is-on' : 'nav-perfmon')}
            aria-label="Performance"
            aria-pressed={() => (bindings.isOpen() ? 'true' : 'false')}
            title={() => (bindings.isOpen() ? 'Performance: shown' : 'Performance: hidden')}
            onClick={() => bindings.onPressed?.()}
        />
    );
}
