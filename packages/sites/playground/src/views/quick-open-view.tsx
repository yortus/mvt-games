/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface QuickOpenViewBindings {
    readonly isOpen: () => boolean;
    /** What the visitor has typed. */
    readonly query: () => string;
    /** The paths that match, best first. */
    readonly matches: () => readonly string[];
    readonly onQueryTyped?: (query: string) => void;
    readonly onPathChosen?: (path: string) => void;
    readonly onClosed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A dialog that opens a file by name, as an editor's Ctrl+P does. Typing
 * narrows the list. Enter opens the first file in it, and Escape, or a
 * press outside the dialog, closes it.
 */
export function QuickOpenView(bindings: QuickOpenViewBindings): Element {
    const watcher = watch({ isOpen: bindings.isOpen });
    watcher.poll();
    /** Whether the dialog has opened since its field last took the focus. */
    let isFocusDue = false;

    return (
        // The wrapper is never hidden, so it sees the dialog close and open again
        <div class="quick-open-layer" onRefresh={noteOpening}>
            <div class="quick-open" visible={bindings.isOpen} onPointerDown={onBackdropPressed}>
                <div class="quick-open-panel" role="dialog" aria-modal="true" aria-label="Open a file">
                    <input
                        type="text"
                        class="quick-open-query"
                        placeholder="Open a file by name"
                        autocomplete="off"
                        spellcheck={false}
                        value={bindings.query}
                        onInput={(event) => bindings.onQueryTyped?.((event.target as HTMLInputElement).value)}
                        onKeyDown={onKeyDown}
                        onRefresh={focusIfDue}
                    />
                    <ul class="quick-open-matches">
                        <List items={bindings.matches}>
                            {(path) => <li><button type="button" class="quick-open-match" text={path} onClick={() => bindings.onPathChosen?.(path())} /></li>}
                        </List>
                    </ul>
                </div>
            </div>
        </div>
    );

    function noteOpening(): void {
        const { isOpen } = watcher.poll();
        if (isOpen.changed && isOpen.value) isFocusDue = true;
    }

    /** Focuses the field once the dialog shows. It runs after the wrapper's step, and after the dialog is shown, since a hidden field cannot take the focus. */
    function focusIfDue(input: Element): void {
        if (!isFocusDue) return;
        isFocusDue = false;
        (input as HTMLInputElement).focus();
    }

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            bindings.onClosed?.();
        }
        else if (event.key === 'Enter') {
            event.preventDefault();
            const first = bindings.matches()[0];
            if (first !== undefined) bindings.onPathChosen?.(first);
        }
    }

    function onBackdropPressed(event: PointerEvent): void {
        if (event.target === event.currentTarget) bindings.onClosed?.();
    }
}
