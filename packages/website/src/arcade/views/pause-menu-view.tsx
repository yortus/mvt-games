/** @jsxImportSource @mvtjs/html */
import { focusOnOpen } from './focus-on-open';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PauseMenuViewBindings {
    readonly isOpen: () => boolean;
    /** How to play the entry, if it says. */
    readonly instructions: () => string | undefined;
    readonly onResumePressed?: () => void;
    readonly onRestartPressed?: () => void;
    readonly onExitPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The menu over a paused entry: resume, restart, how to play, and leave. In
 * HTML, so it works over an entry of any renderer. It opens with Resume
 * focused, so Enter resumes; the arrows, or W and S, move through its
 * choices, round from the top to the bottom, so Up then Enter leaves.
 */
export function PauseMenuView(bindings: PauseMenuViewBindings): Element {
    // Enter resumes
    const focusResume = focusOnOpen({
        isOpen: bindings.isOpen,
        target: (layer) => layer.querySelector<HTMLElement>('.pause-resume') ?? undefined,
    });
    let panel: HTMLElement | undefined;
    window.addEventListener('keydown', onKeyDown);

    return (
        // The focus step is on a wrapper that is never hidden, so it sees the menu close
        <div class="pause-layer" onRefresh={focusResume} onDestroyed={() => window.removeEventListener('keydown', onKeyDown)}>
            <div class="pause-menu" visible={bindings.isOpen}>
                <section class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title" ref={(e) => { panel = e; }}>
                    <h2 id="pause-title" text="Paused" />
                    <button type="button" class="pause-resume" text="Resume" onClick={() => bindings.onResumePressed?.()} />
                    <button type="button" text="Restart" onClick={() => bindings.onRestartPressed?.()} />
                    <details class="pause-how-to" visible={() => bindings.instructions() !== undefined}>
                        <summary text="How to play" />
                        <pre text={() => bindings.instructions() ?? ''} />
                    </details>
                    <button type="button" text="Exit to the arcade" onClick={() => bindings.onExitPressed?.()} />
                </section>
            </div>
        </div>
    );

    /** Up and down through the menu's choices, wrapping round; Enter and Space press the one focused, as buttons do. */
    function onKeyDown(e: KeyboardEvent): void {
        if (!bindings.isOpen() || panel === undefined || e.ctrlKey || e.metaKey || e.altKey) return;
        const step = stepFor(e.key);
        if (step === 0) return;
        const choices = [...panel.querySelectorAll<HTMLElement>('button, summary')].filter((choice) => choice.getClientRects().length > 0);
        if (choices.length === 0) return;
        const current = choices.findIndex((choice) => choice === document.activeElement);
        const next = current < 0 ? (step > 0 ? 0 : choices.length - 1) : (current + step + choices.length) % choices.length;
        choices[next].focus();
        e.preventDefault();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Which way a key moves through the menu: up, down, or not at all. */
function stepFor(key: string): -1 | 0 | 1 {
    switch (key) {
        case 'ArrowUp': case 'w': case 'W': return -1;
        case 'ArrowDown': case 's': case 'S': return 1;
        default: return 0;
    }
}
