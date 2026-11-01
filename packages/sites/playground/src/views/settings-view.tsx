/** @jsxImportSource @mvtjs/html */
import type { ThemeKind } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SettingsViewBindings {
    /** The colour themes to offer, by kind and name, grouped as dark or light. */
    readonly themes: readonly { readonly kind: ThemeKind; readonly name: string; readonly scheme: 'dark' | 'light' }[];
    readonly theme: () => ThemeKind;
    /** Whether a change runs the project again, once the files check clean. */
    readonly isRunOnChange: () => boolean;
    readonly isOpen: () => boolean;
    /** Reported as the settings button is pressed, which opens the settings, or closes them. */
    readonly onPressed?: () => void;
    /** Reported as the visitor presses outside the settings, or presses Escape, while they're open. */
    readonly onClosed?: () => void;
    readonly onThemeChosen?: (theme: ThemeKind) => void;
    readonly onRunOnChangeToggled?: (isOn: boolean) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The playground's settings, for the site's nav: a button that opens a
 * small panel below it, with the colour theme, and whether a change runs
 * the project again. Both are the visitor's, for every project, and kept
 * for the next visit. A press outside the panel, or Escape, closes it.
 */
export function SettingsView(bindings: SettingsViewBindings): Element {
    let element: Element | undefined;
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return (
        <div
            class="settings"
            ref={(settings) => (element = settings)}
            onDestroyed={() => {
                document.removeEventListener('pointerdown', onPointerDown);
                document.removeEventListener('keydown', onKeyDown);
            }}
        >
            <button
                type="button"
                class="settings-button"
                aria-label="Settings"
                title="Settings"
                aria-expanded={bindings.isOpen}
                onClick={() => bindings.onPressed?.()}
            />
            <div class="settings-panel" role="group" aria-label="Settings" visible={bindings.isOpen}>
                <label class="settings-theme">
                    <span class="settings-label" text="Colour theme" />
                    <select class="settings-theme-menu" value={bindings.theme} onChange={onThemeChanged}>
                        <optgroup label="Dark">
                            {bindings.themes.filter((t) => t.scheme === 'dark').map((theme) => <option value={theme.kind} text={theme.name} />)}
                        </optgroup>
                        <optgroup label="Light">
                            {bindings.themes.filter((t) => t.scheme === 'light').map((theme) => <option value={theme.kind} text={theme.name} />)}
                        </optgroup>
                    </select>
                </label>
                <label class="settings-check">
                    <input
                        type="checkbox"
                        checked={bindings.isRunOnChange}
                        onChange={(event) => bindings.onRunOnChangeToggled?.((event.target as HTMLInputElement).checked)}
                    />
                    <span text="Run on change" />
                </label>
                <p class="settings-about" text={RUN_ON_CHANGE_ABOUT} />
            </div>
        </div>
    );

    function onThemeChanged(event: Event): void {
        const kind = (event.target as HTMLSelectElement).value;
        const theme = bindings.themes.find((t) => t.kind === kind);
        if (theme !== undefined) bindings.onThemeChosen?.(theme.kind);
    }

    function onPointerDown(event: PointerEvent): void {
        if (bindings.isOpen() && !(event.target instanceof Node && element?.contains(event.target) === true)) bindings.onClosed?.();
    }

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape' && bindings.isOpen()) bindings.onClosed?.();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const RUN_ON_CHANGE_ABOUT = 'Runs your project again half a second after you stop typing, if it has no problems. Turn it off to keep what\'s on screen while you edit.';
