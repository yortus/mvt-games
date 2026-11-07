/** @jsxImportSource @mvtjs/html */
import { focusOnOpen } from './focus-on-open';
import { PixelTextView } from './pixel-text-view';
import { SoundControlView } from './sound-control-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the pause menu shows, and what it reports. */
export interface PauseMenuViewBindings {
    /** Whether the menu is open. It is open while the entry is paused. */
    readonly isOpen: () => boolean;
    /** The menu's heading, in the pixel font: GAME PAUSED, or DEMO PAUSED. */
    readonly heading: () => string;
    /** The music's volume, from 0 to 1. 0 is off. */
    readonly musicVolume: () => number;
    /** The sound effects' volume, from 0 to 1. 0 is off. */
    readonly sfxVolume: () => number;
    /** Reported as Resume is pressed. */
    readonly onResumePressed?: () => void;
    /** Reported as Restart, or R, is pressed. */
    readonly onRestartPressed?: () => void;
    /**
     * The question for the visitor to confirm, while a restart is
     * requested, such as "Clear this puzzle and start it again?". It shows
     * with Restart and Cancel under it, in place of the menu's choices and
     * volumes.
     */
    readonly restartQuestion?: () => string | undefined;
    /** Reported as the question's Restart, or R, is pressed. */
    readonly onRestartConfirmed?: () => void;
    /** Reported as the question's Cancel is pressed. The page cancels on Escape too, as it resumes on Escape otherwise. */
    readonly onRestartCancelled?: () => void;
    /** Reported as Exit, or X, is pressed. */
    readonly onExitPressed?: () => void;
    /** Reported with the new volume, from 0 to 1, as the music's slider moves. */
    readonly onMusicVolumeChanged?: (volume: number) => void;
    /** Reported as the music's icon is pressed, or Enter on its slider. */
    readonly onMusicIconPressed?: () => void;
    /** Reported with the new volume, from 0 to 1, as the effects' slider moves. */
    readonly onSfxVolumeChanged?: (volume: number) => void;
    /** Reported as the effects' icon is pressed, or Enter on its slider. */
    readonly onSfxIconPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows the menu over a paused entry: its heading, in the pixel font, then
 * Resume, Restart and Exit in a row, then the music's and the sound
 * effects' volumes. How to play the entry, and its highscores, are in its
 * info panel, which the runner's (i) opens. The menu is in HTML, so it works
 * over an entry of any renderer.
 *
 * The menu is quick to leave from the keyboard. It opens with Resume
 * focused, so Enter resumes. Left and Right, or A and D, move along the
 * row, round, so Left then Enter leaves. Up and Down, or W and S, move from
 * the row to each slider, round. Three keys act at once, and each is shown
 * on its button. Escape resumes, R restarts and X leaves.
 *
 * An entry where restarting loses something has the visitor confirm the
 * restart first. Its question shows in place of the choices and volumes,
 * with Restart and Cancel under it, and Cancel has the focus, so Enter
 * cancels. R again restarts, and Escape cancels.
 */
export function PauseMenuView(bindings: PauseMenuViewBindings): Element {
    const question = bindings.restartQuestion ?? (() => undefined);
    const isConfirming = (): boolean => question() !== undefined;
    // Enter resumes, or, while a restart waits to be confirmed, cancels
    const focusResume = focusOnOpen({
        isOpen: () => bindings.isOpen() && !isConfirming(),
        target: (layer) => layer.querySelector<HTMLElement>('.pause-resume') ?? undefined,
    });
    const focusCancel = focusOnOpen({
        isOpen: () => bindings.isOpen() && isConfirming(),
        target: (layer) => layer.querySelector<HTMLElement>('.pause-cancel') ?? undefined,
    });
    const focusOnChange = (layer: Element): void => {
        focusResume(layer);
        focusCancel(layer);
    };
    let panel: HTMLElement | undefined;
    // The row of choices, and the question's row, which shows in its place
    let menuRow: HTMLElement | undefined;
    let questionRow: HTMLElement | undefined;
    window.addEventListener('keydown', onKeyDown);

    return (
        // The steps are on a wrapper that is never hidden, so they see the menu close
        <div
            class="pause-layer"
            onRefresh={focusOnChange}
            onDestroyed={() => window.removeEventListener('keydown', onKeyDown)}
        >
            <div class="pause-menu" visible={bindings.isOpen}>
                <section class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title" ref={(e) => { panel = e; }}>
                    <h2 id="pause-title" class="pause-title"><PixelTextView text={bindings.heading} /></h2>
                    <div class="pause-page" visible={() => !isConfirming()}>
                        <div class="pause-choices" ref={(e) => { menuRow = e; }}>
                            <ChoiceView
                                label="Resume"
                                keyText="Esc"
                                keyShortcut="Escape"
                                className="pause-resume"
                                onPressed={() => bindings.onResumePressed?.()}
                            />
                            <ChoiceView
                                label="Restart"
                                keyText="R"
                                keyShortcut="R"
                                className="pause-restart"
                                onPressed={() => bindings.onRestartPressed?.()}
                            />
                            <ChoiceView
                                label="Exit"
                                title="Exit to the arcade"
                                keyText="X"
                                keyShortcut="X"
                                className="pause-exit"
                                onPressed={() => bindings.onExitPressed?.()}
                            />
                        </div>
                        <div class="pause-sound" role="group" aria-label="Sound">
                            <SoundControlView
                                label="Music"
                                icon="🎵"
                                id="pause-music-volume"
                                volume={bindings.musicVolume}
                                onVolumeChanged={(volume) => bindings.onMusicVolumeChanged?.(volume)}
                                onIconPressed={() => bindings.onMusicIconPressed?.()}
                            />
                            <SoundControlView
                                label="Effects"
                                icon="🔊"
                                id="pause-effects-volume"
                                volume={bindings.sfxVolume}
                                onVolumeChanged={(volume) => bindings.onSfxVolumeChanged?.(volume)}
                                onIconPressed={() => bindings.onSfxIconPressed?.()}
                            />
                        </div>
                    </div>
                    <div class="pause-question" visible={isConfirming}>
                        <p class="pause-question-text" text={() => question() ?? ''} />
                        <div class="pause-choices" ref={(e) => { questionRow = e; }}>
                            <ChoiceView
                                label="Restart"
                                keyText="R"
                                keyShortcut="R"
                                className="pause-confirm"
                                onPressed={() => bindings.onRestartConfirmed?.()}
                            />
                            <ChoiceView
                                label="Cancel"
                                keyText="Esc"
                                keyShortcut="Escape"
                                className="pause-cancel"
                                onPressed={() => bindings.onRestartCancelled?.()}
                            />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );

    /**
     * Handles the menu's keys while it is open. R restarts, or while a
     * restart waits to be confirmed, confirms it, and X leaves, wherever the focus is. Left
     * and Right move along the row of choices, round, but not on a slider,
     * which they move. Up and Down move from the row to each slider, round,
     * and back to the row at Resume. Enter and Space press the focused
     * button, as they always do.
     */
    function onKeyDown(e: KeyboardEvent): void {
        if (!bindings.isOpen() || panel === undefined || e.ctrlKey || e.metaKey || e.altKey) return;
        const shortcut = findShortcut(e.key);
        if (shortcut !== undefined) {
            e.preventDefault();
            // Held down, a key repeats. One press is one restart.
            if (e.repeat) return;
            if (shortcut === 'exit') bindings.onExitPressed?.();
            else if (isConfirming()) bindings.onRestartConfirmed?.();
            else bindings.onRestartPressed?.();
            return;
        }
        const row = isConfirming() ? questionRow : menuRow;
        const choices = row === undefined ? [] : [...row.querySelectorAll<HTMLElement>('button')];
        const sliders = [...panel.querySelectorAll<HTMLElement>('.pause-sound input')];
        if (choices.length === 0) return;
        const focused = document.activeElement;
        const isOnSlider = focused instanceof HTMLInputElement && focused.type === 'range';
        const across = toAcrossStep(e.key);
        if (across !== 0 && !isOnSlider) {
            const current = choices.findIndex((choice) => choice === focused);
            choices[current < 0 ? 0 : (current + across + choices.length) % choices.length].focus();
            e.preventDefault();
            return;
        }
        // The question has no sliders to move to
        const step = isConfirming() ? 0 : toMenuStep(e.key);
        if (step === 0) return;
        // The stops, top to bottom: the row of choices, then each slider
        const stops = sliders.length + 1;
        const sliderIndex = sliders.findIndex((slider) => slider === focused);
        const current = sliderIndex >= 0 ? sliderIndex + 1 : choices.includes(focused as HTMLElement) ? 0 : -1;
        const next = current < 0 ? (step > 0 ? 0 : stops - 1) : (current + step + stops) % stops;
        (next === 0 ? choices[0] : sliders[next - 1]).focus();
        e.preventDefault();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What one of the menu's choices shows, and what it reports. */
interface ChoiceViewBindings {
    /** The button's text. */
    readonly label: string;
    /** Its tooltip, where the label says less than it does. */
    readonly title?: string;
    /** The key shown on the button, such as 'Esc'. */
    readonly keyText: string;
    /** The key that presses the button, as `aria-keyshortcuts` names it, such as 'Escape'. */
    readonly keyShortcut: string;
    /** The button's class. */
    readonly className: string;
    /** Reported as the button is pressed. */
    readonly onPressed: () => void;
}

/**
 * Builds one of the menu's choices, a button with the key that presses it
 * shown on it. The key is hidden on touch screens.
 */
function ChoiceView(bindings: ChoiceViewBindings): Element {
    return (
        <button type="button" class={bindings.className} title={bindings.title} aria-keyshortcuts={bindings.keyShortcut} onClick={bindings.onPressed}>
            <span text={bindings.label} />
            <kbd class="pause-key" aria-hidden="true" text={bindings.keyText} />
        </button>
    );
}

/** Returns what a key does at once, wherever the focus is, or undefined for a key that does nothing. */
function findShortcut(key: string): 'restart' | 'exit' | undefined {
    switch (key) {
        case 'r': case 'R': return 'restart';
        case 'x': case 'X': return 'exit';
        default: return undefined;
    }
}

/** Converts a key to a move along the row of choices. It is -1 for left, 1 for right, and 0 for none. */
function toAcrossStep(key: string): -1 | 0 | 1 {
    switch (key) {
        case 'ArrowLeft': case 'a': case 'A': return -1;
        case 'ArrowRight': case 'd': case 'D': return 1;
        default: return 0;
    }
}

/** Converts a key to a move through the menu. It is -1 for up, 1 for down, and 0 for none. */
function toMenuStep(key: string): -1 | 0 | 1 {
    switch (key) {
        case 'ArrowUp': case 'w': case 'W': return -1;
        case 'ArrowDown': case 's': case 'S': return 1;
        default: return 0;
    }
}
