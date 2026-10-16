// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A dialog the page shows the visitor: a question to confirm, an answer to type, or something to tell. */
export interface Dialog {
    readonly title: string;
    readonly message: string;
    /** For an answer to type: the answer at first. Without it, the dialog has no field. */
    readonly value?: string;
    /** Whether the answer at first is chosen, to type over, or the cursor goes after it, to type more. */
    readonly isValueChosen: boolean;
    /** What the button that agrees says, such as "Delete". */
    readonly confirmLabel: string;
    /** Whether it has Cancel. A dialog that only tells has none. */
    readonly isCancellable: boolean;
    /** Whether agreeing loses something, such as a deleted file, which the button shows. */
    readonly isDangerous: boolean;
}

/**
 * The page's dialogs, in place of the browser's: one at a time, each asked
 * for with a promise of the visitor's answer. A dialog asked for while
 * another shows replaces it, which is answered as cancelled.
 */
export interface Dialogs {
    /** The dialog showing, if any. */
    readonly current: () => Dialog | undefined;
    /** Rises each time a dialog shows, for its view to fill its field and take the focus. */
    readonly shown: () => number;
    /** Asks the visitor to confirm. Gives whether they did. */
    readonly confirm: (dialog: { readonly title: string; readonly message: string; readonly confirmLabel: string; readonly isDangerous?: boolean }) => Promise<boolean>;
    /** Asks the visitor to type an answer. Gives it, or undefined if they cancelled. */
    readonly prompt: (dialog: {
        readonly title: string;
        readonly message: string;
        readonly value: string;
        readonly confirmLabel: string;
        /** Whether the answer at first is chosen, to type over. The default is that it is; else the cursor goes after it. */
        readonly isValueChosen?: boolean;
    }) => Promise<string | undefined>;
    /** Tells the visitor something, and waits until they have read it. */
    readonly tell: (dialog: { readonly title: string; readonly message: string }) => Promise<void>;
    /** From the dialog's view: the visitor's answer, the text typed for a field, or undefined for Cancel. */
    readonly answer: (value: string | undefined) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the page's dialogs, with none showing. */
export function createDialogs(): Dialogs {
    let current: Dialog | undefined;
    let resolve: ((value: string | undefined) => void) | undefined;
    let shown = 0;

    return {
        current: () => current,
        shown: () => shown,

        confirm: async (dialog) => (await show({ ...dialog, isValueChosen: false, isCancellable: true, isDangerous: dialog.isDangerous ?? false })) !== undefined,

        prompt: (dialog) => show({ ...dialog, isValueChosen: dialog.isValueChosen ?? true, isCancellable: true, isDangerous: false }),

        tell: async (dialog) => {
            await show({ ...dialog, confirmLabel: 'OK', isValueChosen: false, isCancellable: false, isDangerous: false });
        },

        answer(value) {
            const answered = resolve;
            current = undefined;
            resolve = undefined;
            answered?.(value);
        },
    };

    function show(dialog: Dialog): Promise<string | undefined> {
        resolve?.(undefined);
        current = dialog;
        shown++;
        return new Promise((done) => {
            resolve = done;
        });
    }
}
