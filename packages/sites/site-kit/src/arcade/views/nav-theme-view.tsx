/** @jsxImportSource @mvtjs/html */
import { THEME_CHOICES, type ThemeChoice, type ThemeKind } from '../models';
import { THEMES } from './themes';
import { listenToPressOutside } from './listen-to-press-outside';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the nav's theme picker shows, and what it reports. */
export interface NavThemeViewBindings {
    /** The visitor's choice of theme. */
    readonly choice: () => ThemeChoice;
    /** The site's own theme, which the default wears. Fixed. */
    readonly siteTheme: ThemeKind;
    /** Reported as the visitor picks a choice from the menu. */
    readonly onChosen?: (choice: ThemeChoice) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A palette in the site's nav, and the menu it drops beneath it: the default,
 * which wears each site's own theme, and each theme, which every site then
 * wears. Each line shows a swatch of the theme it wears, and the choice made
 * is ticked. Whether the menu is open is the view's own: choosing, Escape,
 * or a press anywhere else closes it.
 */
export function NavThemeView(bindings: NavThemeViewBindings): Element {
    let root: HTMLElement | undefined;
    let button: HTMLButtonElement | undefined;
    // Presentation state: whether the menu is open
    let isOpen = false;
    window.addEventListener('keydown', onPageKeyDown);
    const stopPressOutside = listenToPressOutside({
        isOpen: () => isOpen,
        isInside: (target) => root?.contains(target) === true,
        onPressedOutside: () => { isOpen = false; },
    });

    return (
        <div class="nav-theme" ref={(e) => { root = e; }} onDestroyed={stopListening}>
            <button
                type="button"
                class="nav-theme-button"
                ref={(e) => { button = e; }}
                aria-label="Theme"
                title="Theme"
                aria-haspopup="menu"
                aria-expanded={() => (isOpen ? 'true' : 'false')}
                aria-controls="nav-theme-menu"
                onClick={() => { isOpen = !isOpen; }}
            />
            <ul class="nav-theme-menu" id="nav-theme-menu" role="menu" aria-label="Theme" visible={() => isOpen}>
                {THEME_CHOICES.map((choice) => {
                    const theme = THEMES[choice === 'default' ? bindings.siteTheme : choice];
                    return (
                        <li role="none">
                            <button
                                type="button"
                                class="nav-theme-item"
                                role="menuitemradio"
                                aria-checked={() => (bindings.choice() === choice ? 'true' : 'false')}
                                onClick={() => choose(choice)}
                            >
                                <span class="nav-theme-swatch" aria-hidden="true">
                                    {theme.swatch.map((colour) => <span style={`background: ${colour}`} />)}
                                </span>
                                <span text={choice === 'default' ? `Default (${theme.name})` : theme.name} />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );

    function choose(choice: ThemeChoice): void {
        isOpen = false;
        bindings.onChosen?.(choice);
        button?.focus();
    }

    function onPageKeyDown(e: KeyboardEvent): void {
        if (!isOpen || e.key !== 'Escape') return;
        isOpen = false;
        button?.focus();
        e.preventDefault();
    }

    function stopListening(): void {
        window.removeEventListener('keydown', onPageKeyDown);
        stopPressOutside();
    }
}
