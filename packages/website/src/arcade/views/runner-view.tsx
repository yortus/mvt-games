/** @jsxImportSource @mvtjs/html */
import { PauseMenuView } from './pause-menu-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RunnerViewBindings {
    /** The element the entry plays in, filled by the page's entry host. */
    readonly stage: HTMLElement;
    /** Whether an entry has been chosen: loading, ready or playing. */
    readonly isOpen: () => boolean;
    readonly isPlaying: () => boolean;
    readonly isPaused: () => boolean;
    /** The chosen entry's name, and how to play it. */
    readonly title: () => string;
    readonly instructions: () => string | undefined;
    /** Whether the entry's play area is wider than tall: on a phone held upright, a hint suggests turning it. */
    readonly isLandscape: () => boolean;
    readonly onBackPressed?: () => void;
    readonly onPausePressed?: () => void;
    readonly onResumePressed?: () => void;
    readonly onRestartPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Where an entry plays: a bar to leave it, pause it and go fullscreen, the
 * stage the entry fills, and the pause menu over it. It is laid out even
 * while closed, so the stage's size is known before an entry starts, for the
 * transition to aim at.
 */
export function RunnerView(bindings: RunnerViewBindings): Element {
    // Whether the visitor has waved the turn-your-phone hint away: the view's own
    let isHintDismissed = false;
    const canFullscreen = document.fullscreenEnabled;

    return (
        <div class={runnerClass}>
            <header class="runner-bar">
                <button type="button" class="runner-back" aria-label="Back to the arcade" title="Back to the arcade" text="←" onClick={() => bindings.onBackPressed?.()} />
                <h2 class="runner-title" text={bindings.title} />
                <button
                    type="button"
                    class="runner-pause"
                    aria-label="Pause"
                    title="Pause"
                    text="❚❚"
                    disabled={() => !bindings.isPlaying()}
                    onClick={() => bindings.onPausePressed?.()}
                />
                <button
                    type="button"
                    class="runner-fullscreen"
                    aria-label="Full screen"
                    title="Full screen"
                    text="⛶"
                    visible={canFullscreen}
                    onClick={toggleFullscreen}
                />
            </header>
            <div class="runner-frame">
                {bindings.stage}
            </div>
            <div class="runner-rotate-hint" visible={() => bindings.isPlaying() && bindings.isLandscape() && !isHintDismissed}>
                <span text="Turn your phone sideways for a bigger view" />
                <button type="button" aria-label="Dismiss" text="×" onClick={() => { isHintDismissed = true; }} />
            </div>
            <PauseMenuView
                isOpen={bindings.isPaused}
                instructions={bindings.instructions}
                onResumePressed={bindings.onResumePressed}
                onRestartPressed={bindings.onRestartPressed}
                onExitPressed={bindings.onBackPressed}
            />
        </div>
    );

    function runnerClass(): string {
        if (!bindings.isOpen()) return 'runner';
        return bindings.isPlaying() ? 'runner is-open is-playing' : 'runner is-open';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
}
