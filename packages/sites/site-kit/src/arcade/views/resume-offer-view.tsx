/** @jsxImportSource @mvtjs/html */
import { createComputed } from '@mvtjs/utils';
import { focusOnOpen } from './focus-on-open';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the offer to resume a saved game shows, and what it reports. */
export interface ResumeOfferViewBindings {
    /** Whether the offer is open, over the saved game standing still. */
    readonly isOpen: () => boolean;
    /** The name of the game saved. */
    readonly title: () => string;
    /** Reported as Resume, or Escape, is pressed. */
    readonly onResumePressed?: () => void;
    /** Reported as Restart, or R, is pressed. */
    readonly onRestartPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Over a game the visitor left part way through, which shows behind it as
 * they left it: an offer to resume it or to start it again. Resume has the
 * focus as the offer opens, so Enter resumes. Escape resumes too, and R
 * restarts, as they do in the pause menu.
 */
export function ResumeOfferView(bindings: ResumeOfferViewBindings): Element {
    const focusResume = focusOnOpen({
        isOpen: bindings.isOpen,
        target: (layer) => layer.querySelector<HTMLElement>('.resume-offer-resume') ?? undefined,
    });
    const offerText = createComputed({ watch: bindings.title, compute: describeOffer });
    window.addEventListener('keydown', onKeyDown);

    return (
        // The focus step is on a wrapper that is never hidden, so it sees the offer close
        <div class="resume-offer-layer" onRefresh={focusResume} onDestroyed={() => window.removeEventListener('keydown', onKeyDown)}>
            <div class="resume-offer" visible={bindings.isOpen}>
                <section class="resume-offer-panel" role="dialog" aria-modal="true" aria-labelledby="resume-offer-title">
                    <h2 id="resume-offer-title" class="resume-offer-title" text="Welcome back" />
                    <p class="resume-offer-text" text={offerText} />
                    <button type="button" class="resume-offer-resume" aria-keyshortcuts="Escape" onClick={() => bindings.onResumePressed?.()}>
                        <span text="Resume" />
                        <kbd class="pause-key" aria-hidden="true" text="Esc" />
                    </button>
                    <button type="button" class="resume-offer-restart" aria-keyshortcuts="R" onClick={() => bindings.onRestartPressed?.()}>
                        <span text="Restart" />
                        <kbd class="pause-key" aria-hidden="true" text="R" />
                    </button>
                </section>
            </div>
        </div>
    );

    function onKeyDown(e: KeyboardEvent): void {
        if (!bindings.isOpen() || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        if (e.key === 'Escape') bindings.onResumePressed?.();
        else if (e.key === 'r' || e.key === 'R') bindings.onRestartPressed?.();
        else return;
        e.preventDefault();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function describeOffer(title: string): string {
    return `Your last game of ${title} was saved as you left it.`;
}
