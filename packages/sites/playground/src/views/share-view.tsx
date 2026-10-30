/** @jsxImportSource @mvtjs/html */
import { createReaction } from '@mvtjs/utils';
import type { ShareStatus } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ShareViewBindings {
    /** Where sharing is. The dialog shows unless it is `idle`. */
    readonly status: () => ShareStatus;
    /** The link, once it is written. */
    readonly link: () => string | undefined;
    readonly onCopyPressed?: () => void;
    readonly onExportPressed?: () => void;
    readonly onClosed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The Share dialog: the project's link, which the page copies as the dialog
 * opens, with whether that worked, and a button to copy it again. A
 * project too large for a link is offered Export instead. Escape, or a press
 * outside the dialog, closes it.
 */
export function ShareView(bindings: ShareViewBindings): Element {
    const isOpen = (): boolean => bindings.status() !== 'idle';
    const isTooLarge = (): boolean => bindings.status() === 'too-large';
    /** Whether the dialog has opened since it last took the focus. */
    let isFocusDue = false;
    const queueFocusWhenOpened = createReaction({
        watch: isOpen,
        when: true,
        react: () => {
            isFocusDue = true;
        },
    });

    return (
        // The wrapper is never hidden, so it sees the dialog close and open again
        <div class="share-layer" onRefresh={queueFocusWhenOpened}>
            <div class="share" visible={isOpen} onPointerDown={onBackdropPressed} onKeyDown={onKeyDown}>
                <div class="share-panel" role="dialog" aria-modal="true" aria-label="Share" tabIndex={-1} onRefresh={focusIfDue}>
                    <div class="share-head">
                        <h2 class="share-title" text="Share" />
                        <button type="button" class="share-close" text="Close" onClick={() => bindings.onClosed?.()} />
                    </div>
                    <div class="share-body" visible={() => !isTooLarge()}>
                        <p
                            class="share-about"
                            text="Anyone with this link can open a copy of the project. The project is in the link itself, so nothing is uploaded."
                        />
                        <div class="share-row">
                            <input
                                type="text"
                                class="share-link"
                                readOnly={true}
                                aria-label="The link"
                                value={() => bindings.link() ?? ''}
                                onFocus={(event) => (event.target as HTMLInputElement).select()}
                            />
                            <button
                                type="button"
                                class="share-copy"
                                text="Copy"
                                disabled={() => bindings.link() === undefined}
                                onClick={() => bindings.onCopyPressed?.()}
                            />
                        </div>
                        <p class={() => STATUS_CLASSES[bindings.status()]} role="status" text={() => STATUS_TEXTS[bindings.status()]} />
                    </div>
                    <div class="share-body" visible={isTooLarge}>
                        <p class="share-about" text="This project is too large for a link. Export it instead, as a zip of a project of its own." />
                        <div class="share-row">
                            <button type="button" class="share-export" text="Export" onClick={() => bindings.onExportPressed?.()} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    /**
     * Focuses the dialog once it shows, so Escape closes it, and Tab goes to
     * its buttons. Its Copy button cannot take the focus itself: it is off
     * until the link is made. A hidden element cannot take the focus either.
     */
    function focusIfDue(panel: Element): void {
        if (!isFocusDue) return;
        isFocusDue = false;
        (panel as HTMLElement).focus();
    }

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        bindings.onClosed?.();
    }

    function onBackdropPressed(event: PointerEvent): void {
        if (event.target === event.currentTarget) bindings.onClosed?.();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const STATUS_TEXTS: Readonly<Record<ShareStatus, string>> = {
    'idle': '',
    'sharing': 'Making the link...',
    'copied': 'Link copied to the clipboard.',
    'too-large': '',
    'failed': 'The browser did not let the page copy the link. Select it, and copy it yourself.',
};

const STATUS_CLASSES: Readonly<Record<ShareStatus, string>> = {
    'idle': 'share-status',
    'sharing': 'share-status',
    'copied': 'share-status share-status-copied',
    'too-large': 'share-status',
    'failed': 'share-status share-status-failed',
};
