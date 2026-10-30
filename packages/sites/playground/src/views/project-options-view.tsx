/** @jsxImportSource @mvtjs/html */
import { createReaction } from '@mvtjs/utils';
import { MAX_DESCRIPTION_LENGTH } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ProjectOptionsViewBindings {
    readonly isOpen: () => boolean;
    /** The project's name. */
    readonly name: () => string;
    /** What the project is, in the visitor's words, or '' for none. */
    readonly description: () => string;
    /** Whether the playground writes the project's barrels, and imports go through them. */
    readonly isBarrelKept: () => boolean;
    /** Reported with the name the visitor gave. Returns why the project cannot have it, if it cannot. */
    readonly onRenamePressed?: (name: string) => string | undefined;
    readonly onDescriptionTyped?: (description: string) => void;
    readonly onBarrelKeptToggled?: (isKept: boolean) => void;
    readonly onClosed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The open project's options: its name, a description of it, if the
 * visitor gives one, which the Projects list shows, and whether its barrels
 * are auto-generated, with what that means either way. The description is
 * kept as it is typed. Escape, or a press outside the dialog, closes it.
 */
export function ProjectOptionsView(bindings: ProjectOptionsViewBindings): Element {
    /** Whether the dialog has opened since its field last took the focus. */
    let isFocusDue = false;
    /** Why the name last given could not be had, until the dialog opens again. Presentation state: the model keeps no failed names. */
    let renameProblem = '';
    let field: HTMLInputElement | undefined;
    // Fills the field with the project's name as the dialog opens, and forgets a problem from before
    const resetFormWhenOpened = createReaction({
        watch: bindings.isOpen,
        when: true,
        react: () => {
            if (field !== undefined) field.value = bindings.name();
            renameProblem = '';
            isFocusDue = true;
        },
    });

    return (
        // The wrapper is never hidden, so it sees the dialog close and open again
        <div class="options-layer" onRefresh={resetFormWhenOpened}>
            <div class="options" visible={bindings.isOpen} onPointerDown={onBackdropPressed} onKeyDown={onKeyDown}>
                <div class="options-panel" role="dialog" aria-modal="true" aria-label="Project options">
                    <div class="options-head">
                        <h2 class="options-title" text="Project options" />
                        <button type="button" class="options-close" text="Close" onClick={() => bindings.onClosed?.()} />
                    </div>
                    <label class="options-label" text="Name" />
                    <div class="options-row">
                        <input
                            type="text"
                            class="options-name"
                            aria-label="The project's name"
                            autocomplete="off"
                            spellcheck={false}
                            ref={(input) => {
                                field = input as HTMLInputElement;
                            }}
                            onRefresh={focusIfDue}
                        />
                        <button type="button" class="options-rename" text="Rename" onClick={rename} />
                    </div>
                    <p class="options-problem" visible={() => renameProblem !== ''} text={() => renameProblem} />
                    <label class="options-label" text="Description (optional)" />
                    <textarea
                        class="options-description"
                        aria-label="The project's description"
                        rows={3}
                        placeholder="What the project is, for the Projects list"
                        value={bindings.description}
                        ref={(area) => {
                            (area as HTMLTextAreaElement).maxLength = MAX_DESCRIPTION_LENGTH;
                        }}
                        onInput={(event) => bindings.onDescriptionTyped?.((event.target as HTMLTextAreaElement).value)}
                    />
                    <label class="options-check">
                        <input
                            type="checkbox"
                            checked={bindings.isBarrelKept}
                            onChange={(event) => bindings.onBarrelKeptToggled?.((event.target as HTMLInputElement).checked)}
                        />
                        <span text="Auto-generate barrels" />
                    </label>
                    <p class="options-about" text={() => (bindings.isBarrelKept() ? BARRELS_ON : BARRELS_OFF)} />
                </div>
            </div>
        </div>
    );

    /** Focuses the name, chosen, in its own step, once the dialog shows it. */
    function focusIfDue(input: Element): void {
        if (!isFocusDue) return;
        isFocusDue = false;
        (input as HTMLInputElement).focus();
        (input as HTMLInputElement).select();
    }

    function rename(): void {
        renameProblem = bindings.onRenamePressed?.(field?.value ?? '') ?? '';
        if (renameProblem === '' && field !== undefined) field.value = bindings.name();
    }

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            bindings.onClosed?.();
        }
        else if (event.key === 'Enter' && event.target === field) {
            event.preventDefault();
            rename();
        }
    }

    function onBackdropPressed(event: PointerEvent): void {
        if (event.target === event.currentTarget) bindings.onClosed?.();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BARRELS_ON = 'The playground writes each folder\'s index.ts, in place of any there, and imports from another folder go through it.';
const BARRELS_OFF = 'No rule at all, and barrels are ordinary files: keep them, change them, or have none. Import however you like.';
