/** @jsxImportSource @mvtjs/html */
import { watch } from '@mvtjs/utils';
import type { Dialog, Dialogs } from './dialogs';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DialogViewBindings {
    /** The page's dialogs, whose current one this view shows, and answers. */
    readonly dialogs: Dialogs;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The page's dialog, themed as the page is: a title, a message, a field for
 * an answer where it asks for one, and its buttons. Enter agrees, and
 * Escape, or a press outside the dialog, cancels, where it can.
 */
export function DialogView(bindings: DialogViewBindings): Element {
    const { dialogs } = bindings;
    const watcher = watch({ shown: dialogs.shown });
    watcher.poll();
    /** Whether a new dialog has shown since it last took the focus. */
    let isFocusDue = false;
    let field: HTMLInputElement | undefined;

    const dialog = (): Dialog | undefined => dialogs.current();
    const hasField = (): boolean => dialog()?.value !== undefined;

    return (
        // The wrapper is never hidden, so it sees each dialog come
        <div class="dialog-layer" onRefresh={noteOpening}>
            <div class="dialog" visible={() => dialog() !== undefined} onPointerDown={onBackdropPressed} onKeyDown={onKeyDown}>
                <div class="dialog-panel" role="dialog" aria-modal="true" aria-label={() => dialog()?.title ?? ''} tabIndex={-1}>
                    <h2 class="dialog-title" text={() => dialog()?.title ?? ''} />
                    <p class="dialog-message" text={() => dialog()?.message ?? ''} />
                    <input
                        type="text"
                        class="dialog-field"
                        autocomplete="off"
                        spellcheck={false}
                        visible={hasField}
                        ref={(input) => {
                            field = input as HTMLInputElement;
                        }}
                        onRefresh={(input) => focusIfDue(input, true)}
                    />
                    <div class="dialog-buttons">
                        <button type="button" class="dialog-cancel" text="Cancel" visible={() => dialog()?.isCancellable ?? false} onClick={cancel} />
                        <button
                            type="button"
                            class={() => (dialog()?.isDangerous === true ? 'dialog-confirm dialog-confirm-danger' : 'dialog-confirm')}
                            text={() => dialog()?.confirmLabel ?? ''}
                            onClick={agree}
                            onRefresh={(button) => focusIfDue(button, false)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    /** Fills the field with a new dialog's answer, and has the dialog take the focus. */
    function noteOpening(): void {
        if (!watcher.poll().shown.increased) return;
        if (field !== undefined) field.value = dialog()?.value ?? '';
        isFocusDue = true;
    }

    /**
     * Focuses the field, its text chosen or the cursor after it, where the dialog has one, or else
     * the agreeing button. Each does it in its own refresh step, which runs
     * once its own `visible` has shown it: a hidden element cannot take the
     * focus, and a parent's step runs before its children's bindings.
     */
    function focusIfDue(element: Element, isField: boolean): void {
        if (!isFocusDue || isField !== hasField()) return;
        isFocusDue = false;
        (element as HTMLElement).focus();
        if (!isField) return;
        const input = element as HTMLInputElement;
        if (dialog()?.isValueChosen === true) input.select();
        else input.setSelectionRange(input.value.length, input.value.length);
    }

    function agree(): void {
        dialogs.answer(hasField() ? (field?.value ?? '') : '');
    }

    function cancel(): void {
        if (dialog()?.isCancellable === true) dialogs.answer(undefined);
        else dialogs.answer('');
    }

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
        }
        else if (event.key === 'Enter' && event.target === field) {
            event.preventDefault();
            agree();
        }
    }

    function onBackdropPressed(event: PointerEvent): void {
        if (event.target === event.currentTarget) cancel();
    }
}
