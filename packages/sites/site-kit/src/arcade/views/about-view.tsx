/** @jsxImportSource @mvtjs/html */

import { listenToPressOutside } from './listen-to-press-outside';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface AboutViewBindings {
    /** The site's name, in the button's label for assistive technology: `'Demos'`. Fixed. */
    readonly label: string;
    /** What the site holds, the note's first paragraph. Fixed. */
    readonly text: string;
    /** Where the docs are, from the site's page. */
    readonly docsHref: string;
    /** Whether the note is open. */
    readonly isOpen: () => boolean;
    /** Reported as the visitor presses the (i), to open or close the note. */
    readonly onAboutPressed?: () => void;
    /** Reported as the visitor presses Escape, or anywhere else, while the note is open. */
    readonly onDismissed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An (i) button for the site's nav, at its right end, and the note it drops
 * beneath it: what the site is, a link to the docs, the keys, and a word on
 * the classics its games credit. Escape, or a press anywhere else, dismisses
 * the note.
 */
export function AboutView(bindings: AboutViewBindings): Element {
    let root: HTMLElement | undefined;
    window.addEventListener('keydown', onPageKeyDown);
    const stopPressOutside = listenToPressOutside({
        isOpen: bindings.isOpen,
        isInside: (target) => root?.contains(target) === true,
        onPressedOutside: () => bindings.onDismissed?.(),
    });

    return (
        <div class="about" ref={(e) => { root = e; }} onDestroyed={stopListening}>
            <button
                type="button"
                class="about-button"
                aria-label={`About the ${bindings.label.toLowerCase()}`}
                title="About"
                aria-expanded={bindings.isOpen}
                aria-controls="about-note"
                onClick={() => bindings.onAboutPressed?.()}
            />
            <div class="about-note" id="about-note" role="note" visible={bindings.isOpen}>
                <p text={bindings.text} />
                <a class="about-docs" href={bindings.docsHref} text="Read the docs" />
                <ul class="about-keys" aria-label="Keys">
                    {KEYS.map(([keys, what]) => (
                        <li>
                            <span class="about-key">
                                {keys.map((key, i) => (i === 0
                                    ? <kbd text={key} />
                                    : (
                                            <span class="about-key">
                                                <span class="about-or" text="or" />
                                                <kbd text={key} />
                                            </span>
                                        )))}
                            </span>
                            <span text={what} />
                        </li>
                    ))}
                </ul>
                <p
                    class="about-credits"
                    text="Some games credit the classics that inspired them. Those classics' names are their owners' trademarks, and this site is not affiliated with them."
                />
            </div>
        </div>
    );

    function onPageKeyDown(e: KeyboardEvent): void {
        if (!bindings.isOpen() || e.key !== 'Escape') return;
        bindings.onDismissed?.();
        e.preventDefault();
    }

    function stopListening(): void {
        window.removeEventListener('keydown', onPageKeyDown);
        stopPressOutside();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The four arrows, spaced, each asking for its plain text form rather than an emoji. */
const ARROWS = ['\u2190', '\u2191', '\u2193', '\u2192'].map((arrow) => `${arrow}\uFE0E`).join('\u2009');

/** Each line: the keys that do it, any one of them, and what they do. */
const KEYS: readonly (readonly [readonly string[], string])[] = [
    [['/'], 'Search, or leave the search'],
    [[ARROWS, 'WASD'], 'Move between items'],
    [['Enter', 'Space'], 'Play the selected item'],
    [['i'], 'Show more info about the selected item'],
    [['Esc'], 'Pause, or leave'],
];
