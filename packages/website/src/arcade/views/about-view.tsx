/** @jsxImportSource @mvtjs/html */

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface AboutViewBindings {
    /** Where the docs are, from the arcade's page. */
    readonly docsHref: string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An (i) button by the arcade's title, and the note it opens beneath it: what
 * the arcade is, a link to the docs, and the keys. The note is open or closed
 * as the button says, closing too on Escape or a press anywhere else: this
 * view's own state, since nothing else cares.
 */
export function AboutView(bindings: AboutViewBindings): Element {
    let isOpen = false;
    let root: HTMLElement | undefined;
    window.addEventListener('keydown', onPageKeyDown);
    window.addEventListener('pointerdown', onPagePointerDown);

    return (
        <div class="about" ref={(e) => { root = e; }} onDestroyed={stopListening}>
            <button
                type="button"
                class="about-button"
                aria-label="About the arcade"
                title="About"
                aria-expanded={() => isOpen}
                aria-controls="about-note"
                text="i"
                onClick={() => { isOpen = !isOpen; }}
            />
            <div class="about-note" id="about-note" role="note" visible={() => isOpen}>
                <p text="Games, demos and art, each built with Model-View-Ticker (MVT), an architecture for games and interactive apps. Pick one to play it, or open its info to read how it is made." />
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
            </div>
        </div>
    );

    function onPageKeyDown(e: KeyboardEvent): void {
        if (!isOpen || e.key !== 'Escape') return;
        isOpen = false;
        e.preventDefault();
    }

    function onPagePointerDown(e: PointerEvent): void {
        if (isOpen && root !== undefined && !(e.target instanceof Node && root.contains(e.target))) isOpen = false;
    }

    function stopListening(): void {
        window.removeEventListener('keydown', onPageKeyDown);
        window.removeEventListener('pointerdown', onPagePointerDown);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The four arrows, spaced, each asking for its plain text form rather than an emoji. */
const ARROWS = ['\u2190', '\u2191', '\u2193', '\u2192'].map((arrow) => `${arrow}\uFE0E`).join('\u2009');

/** Each line: the keys that do it, any one of them, and what they do. */
const KEYS: readonly (readonly [readonly string[], string])[] = [
    [['/'], 'Search'],
    [[ARROWS, 'WASD'], 'Move between items'],
    [['Enter', 'Space'], 'Play the selected item'],
    [['i'], 'Show more info about the selected item'],
    [['Esc'], 'Pause, or leave'],
];
