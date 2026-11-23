/** @jsxImportSource @mvtjs/html */
import { THEME_CHOICES, type ThemeChoice, type ThemeKind } from '../models';
import { THEMES } from './themes';
import { listenToPressOutside } from './listen-to-press-outside';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the nav's view picker shows, and what it reports. */
export interface NavThemeViewBindings {
    /** The visitor's choice of theme, which the card wall wears. */
    readonly choice: () => ThemeChoice;
    /** The site's own theme, which the default wears. Fixed. */
    readonly siteTheme: ThemeKind;
    /** Reported as the visitor picks a card wall from the menu. */
    readonly onChosen?: (choice: ThemeChoice) => void;
    /** The name of the site's showcase, for a site with one, which the menu then offers too. Fixed. */
    readonly showcaseName?: string;
    /** Whether the visitor browses the showcase. Its choice is ticked while they do. */
    readonly isShowcaseOn?: () => boolean;
    /** Reported as the visitor picks the showcase from the menu. */
    readonly onShowcaseChosen?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A palette in the site's nav, and the menu it drops beneath it, for how
 * the visitor browses the site's entries. They choose a card wall in one of
 * the themes, each shown with a swatch, or the site's showcase, if it has
 * one. The default card wall wears each site's own theme. The choice made is
 * ticked. Whether the menu is open is the view's own: choosing, Escape, or a
 * press anywhere else closes it.
 */
export function NavThemeView(bindings: NavThemeViewBindings): Element {
    let root: HTMLElement | undefined;
    let button: HTMLButtonElement | undefined;
    // Presentation state: whether the menu is open
    let isOpen = false;
    const isShowcaseOn = (): boolean => bindings.isShowcaseOn?.() === true;
    const { showcaseName } = bindings;
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
                aria-label="View"
                title="View"
                aria-haspopup="menu"
                aria-expanded={() => (isOpen ? 'true' : 'false')}
                aria-controls="nav-theme-menu"
                onClick={() => { isOpen = !isOpen; }}
            />
            <ul class="nav-theme-menu" id="nav-theme-menu" role="menu" aria-label="View" visible={() => isOpen}>
                <li class="nav-theme-heading" role="none" aria-hidden="true" text="Card wall" />
                {THEME_CHOICES.map((choice) => {
                    const theme = THEMES[choice === 'default' ? bindings.siteTheme : choice];
                    const name = choice === 'default' ? `Site's own (${theme.name})` : theme.name;
                    return (
                        <li role="none">
                            <button
                                type="button"
                                class="nav-theme-item"
                                role="menuitemradio"
                                aria-label={`${name} card wall`}
                                aria-checked={() => (!isShowcaseOn() && bindings.choice() === choice ? 'true' : 'false')}
                                onClick={() => choose(choice)}
                            >
                                <span class="nav-theme-swatch" aria-hidden="true">
                                    {theme.swatch.map((colour) => <span style={`background: ${colour}`} />)}
                                </span>
                                <span text={name} />
                            </button>
                        </li>
                    );
                })}
                {(showcaseName === undefined
                    ? []
                    : [
                            <li class="nav-theme-heading" role="none" aria-hidden="true" text="Showcase" />,
                            <li role="none">
                                <button
                                    type="button"
                                    class="nav-theme-item"
                                    role="menuitemradio"
                                    aria-label={`${showcaseName} showcase`}
                                    aria-checked={() => (isShowcaseOn() ? 'true' : 'false')}
                                    onClick={chooseShowcase}
                                >
                                    <span class="nav-theme-cube" aria-hidden="true" />
                                    <span text={showcaseName} />
                                </button>
                            </li>,
                        ])}
            </ul>
        </div>
    );

    function choose(choice: ThemeChoice): void {
        close();
        bindings.onChosen?.(choice);
    }

    function chooseShowcase(): void {
        close();
        bindings.onShowcaseChosen?.();
    }

    function close(): void {
        isOpen = false;
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
