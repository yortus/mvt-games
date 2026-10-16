/** @jsxImportSource @mvtjs/html */

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HeaderViewBindings {
    readonly projectName: () => string;
    /** The examples to offer, by id and name. */
    readonly examples: readonly { readonly id: string; readonly name: string }[];
    /** What the Share button says: "Share", or how sharing went. */
    readonly shareLabel: () => string;
    readonly isSharing: () => boolean;
    readonly onExampleChosen?: (id: string) => void;
    readonly onSharePressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The playground's header: the project's name, a menu of examples to open, and Share. */
export function HeaderView(bindings: HeaderViewBindings): Element {
    return (
        <header class="header">
            <h1 class="header-title" text="Playground" />
            <span class="header-project" text={bindings.projectName} />
            <select class="header-examples" aria-label="Open an example" value={() => ''} onChange={onExampleChanged}>
                <option value="" text="Open an example..." />
                {bindings.examples.map((example) => <option value={example.id} text={example.name} />)}
            </select>
            <button type="button" class="header-share" text={bindings.shareLabel} disabled={bindings.isSharing} onClick={() => bindings.onSharePressed?.()} />
        </header>
    );

    function onExampleChanged(event: Event): void {
        const id = (event.target as HTMLSelectElement).value;
        if (id !== '') bindings.onExampleChosen?.(id);
    }
}
