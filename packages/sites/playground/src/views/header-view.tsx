/** @jsxImportSource @mvtjs/html */
import { watch } from '@mvtjs/utils';
import type { ThemeKind } from '../models';

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
    /** Rises each time the visitor asks to save, for a moment's note that the project is saved. */
    readonly saves: () => number;
    /** The colour themes to offer, by kind and name, grouped as dark or light. */
    readonly themes: readonly { readonly kind: ThemeKind; readonly name: string; readonly scheme: 'dark' | 'light' }[];
    readonly theme: () => ThemeKind;
    readonly onExampleChosen?: (id: string) => void;
    readonly onSharePressed?: () => void;
    readonly onThemeChosen?: (theme: ThemeKind) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The playground's header: the project's name, a menu of examples to open,
 * the colour theme, and Share. The project is saved as it changes, so a
 * request to save only says so: "Saved" shows beside the name for a moment.
 */
export function HeaderView(bindings: HeaderViewBindings): Element {
    const watcher = watch({ saves: bindings.saves });
    watcher.poll();
    let savedNoteMs = 0;

    return (
        <header class="header" onUpdate={update}>
            <h1 class="header-title" text="Playground" />
            <span class="header-project" text={bindings.projectName} />
            <span class="header-saved" text="Saved" visible={() => savedNoteMs > 0} />
            <select class="header-theme" aria-label="Colour theme" value={bindings.theme} onChange={onThemeChanged}>
                <optgroup label="Dark">
                    {bindings.themes.filter((t) => t.scheme === 'dark').map((theme) => <option value={theme.kind} text={theme.name} />)}
                </optgroup>
                <optgroup label="Light">
                    {bindings.themes.filter((t) => t.scheme === 'light').map((theme) => <option value={theme.kind} text={theme.name} />)}
                </optgroup>
            </select>
            <select class="header-examples" aria-label="Open an example" value={() => ''} onChange={onExampleChanged}>
                <option value="" text="Open an example..." />
                {bindings.examples.map((example) => <option value={example.id} text={example.name} />)}
            </select>
            <button type="button" class="header-share" text={bindings.shareLabel} disabled={bindings.isSharing} onClick={() => bindings.onSharePressed?.()} />
        </header>
    );

    function update(deltaMs: number): void {
        if (watcher.poll().saves.increased) savedNoteMs = SAVED_NOTE_MS;
        else savedNoteMs = Math.max(0, savedNoteMs - deltaMs);
    }

    function onThemeChanged(event: Event): void {
        const kind = (event.target as HTMLSelectElement).value;
        const theme = bindings.themes.find((t) => t.kind === kind);
        if (theme !== undefined) bindings.onThemeChosen?.(theme.kind);
    }

    function onExampleChanged(event: Event): void {
        const id = (event.target as HTMLSelectElement).value;
        if (id !== '') bindings.onExampleChosen?.(id);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long "Saved" shows. */
const SAVED_NOTE_MS = 1500;
