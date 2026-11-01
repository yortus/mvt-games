/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';
import { createComputed } from '@mvtjs/utils';
import type { EntryNotice } from '../../entry-types';
import { focusOnOpen } from './focus-on-open';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What an entry's notice shows, and what it reports. */
export interface EntryNoticeViewBindings {
    /** Whether the notice is open, over the entry standing still. */
    readonly isOpen: () => boolean;
    /** The notice to show. */
    readonly notice: () => EntryNotice | undefined;
    /**
     * Reported as Continue is pressed. `isShownAgain` is false when the
     * visitor ticked the box to not see the notice again.
     */
    readonly onContinuePressed?: (isShownAgain: boolean) => void;
    /** Reported as Back, or Escape, is pressed: the visitor would rather not play. */
    readonly onBackPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Over an entry that has just started, which stands still behind it: what
 * the visitor should know before they play. Continue has the focus as the
 * notice opens, so Enter goes on. A box ticked first keeps the notice from
 * showing next time. Back, or Escape, leaves the entry instead.
 *
 * Whether the box is ticked is the view's own presentation state, until the
 * visitor presses a button. It starts unticked each time the notice opens.
 */
export function EntryNoticeView(bindings: EntryNoticeViewBindings): Element {
    const focusContinue = focusOnOpen({
        isOpen: bindings.isOpen,
        target: (layer) => layer.querySelector<HTMLElement>('.entry-notice-continue') ?? undefined,
    });
    const paragraphs = createComputed({ watch: () => bindings.notice()?.text, compute: splitParagraphs });
    // Presentation state: whether the box to hide the notice from now on is ticked
    let isHideTicked = false;
    window.addEventListener('keydown', onKeyDown);

    return (
        // The focus step is on a wrapper that is never hidden, so it sees the notice close
        <div class="entry-notice-layer" onRefresh={focusContinue} onDestroyed={() => window.removeEventListener('keydown', onKeyDown)}>
            <div class="entry-notice" visible={bindings.isOpen}>
                <section
                    class="entry-notice-panel"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="entry-notice-title"
                    aria-describedby="entry-notice-text"
                >
                    <h2 id="entry-notice-title" class="entry-notice-title" text={() => bindings.notice()?.title ?? ''} />
                    <div id="entry-notice-text" class="entry-notice-text">
                        <List items={paragraphs}>
                            {(paragraph) => <p text={paragraph} />}
                        </List>
                    </div>
                    <label class="entry-notice-hide">
                        <input
                            type="checkbox"
                            checked={() => isHideTicked}
                            onChange={(event) => { isHideTicked = (event.target as HTMLInputElement).checked; }}
                        />
                        <span text="Don't show this again" />
                    </label>
                    <div class="entry-notice-buttons">
                        <button type="button" class="entry-notice-back" aria-keyshortcuts="Escape" onClick={goBack}>
                            <span text="Back" />
                            <kbd class="pause-key" aria-hidden="true" text="Esc" />
                        </button>
                        <button type="button" class="entry-notice-continue" text="Continue" onClick={goOn} />
                    </div>
                </section>
            </div>
        </div>
    );

    function goOn(): void {
        const isShownAgain = !isHideTicked;
        isHideTicked = false;
        bindings.onContinuePressed?.(isShownAgain);
    }

    function goBack(): void {
        isHideTicked = false;
        bindings.onBackPressed?.();
    }

    function onKeyDown(e: KeyboardEvent): void {
        if (!bindings.isOpen() || e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        e.preventDefault();
        goBack();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function splitParagraphs(text: string | undefined): string[] {
    return text?.split('\n\n') ?? [];
}
