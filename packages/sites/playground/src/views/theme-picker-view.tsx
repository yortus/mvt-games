/** @jsxImportSource @mvtjs/html */
import type { ThemeKind } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ThemePickerViewBindings {
    /** The colour themes to offer, by kind and name, grouped as dark or light. */
    readonly themes: readonly { readonly kind: ThemeKind; readonly name: string; readonly scheme: 'dark' | 'light' }[];
    readonly theme: () => ThemeKind;
    readonly onThemeChosen?: (theme: ThemeKind) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A menu of the colour themes, grouped as dark and light, for the site's
 * nav. On a narrow screen it shows as a small ◐, the menu over it unseen, so
 * a press still opens the list.
 */
export function ThemePickerView(bindings: ThemePickerViewBindings): Element {
    return (
        <label class="theme-picker" title="Colour theme">
            <span class="theme-picker-icon" aria-hidden="true" text="◐" />
            <select class="theme-picker-menu" aria-label="Colour theme" value={bindings.theme} onChange={onChanged}>
                <optgroup label="Dark">
                    {bindings.themes.filter((t) => t.scheme === 'dark').map((theme) => <option value={theme.kind} text={theme.name} />)}
                </optgroup>
                <optgroup label="Light">
                    {bindings.themes.filter((t) => t.scheme === 'light').map((theme) => <option value={theme.kind} text={theme.name} />)}
                </optgroup>
            </select>
        </label>
    );

    function onChanged(event: Event): void {
        const kind = (event.target as HTMLSelectElement).value;
        const theme = bindings.themes.find((t) => t.kind === kind);
        if (theme !== undefined) bindings.onThemeChosen?.(theme.kind);
    }
}
