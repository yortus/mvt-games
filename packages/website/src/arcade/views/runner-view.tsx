/** @jsxImportSource @mvtjs/html */
import { PauseMenuView } from './pause-menu-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the runner shows, and what it reports. */
export interface RunnerViewBindings {
    /** The element the entry plays in, filled by the page's entry host. */
    readonly stage: HTMLElement;
    /** Whether an entry has been chosen. It may be loading, ready or playing. */
    readonly isOpen: () => boolean;
    /** Whether the chosen entry is playing. */
    readonly isPlaying: () => boolean;
    /** Whether the entry is paused. The pause menu shows while it is. */
    readonly isPaused: () => boolean;
    /** The music's volume, from 0 to 1. 0 is off. The pause menu shows it. */
    readonly musicVolume: () => number;
    /** The sound effects' volume, from 0 to 1. 0 is off. The pause menu shows it. */
    readonly effectsVolume: () => number;
    /** The chosen entry's name. */
    readonly title: () => string;
    /** How to play the chosen entry, if it says. */
    readonly instructions: () => string | undefined;
    /** Whether the entry's play area is wider than tall. On a phone held upright, a hint suggests turning it. */
    readonly isLandscape: () => boolean;
    /** Reported as the back button, or the pause menu's Exit, is pressed. */
    readonly onBackPressed?: () => void;
    /** Reported as the pause button is pressed. */
    readonly onPausePressed?: () => void;
    /** Reported as the pause menu's Resume is pressed. */
    readonly onResumePressed?: () => void;
    /** Reported as the pause menu's Restart is pressed. */
    readonly onRestartPressed?: () => void;
    /** Reported with the new volume, from 0 to 1, as the music's slider moves. */
    readonly onMusicVolumeChanged?: (volume: number) => void;
    /** Reported as the music's icon is pressed. */
    readonly onMusicIconPressed?: () => void;
    /** Reported with the new volume, from 0 to 1, as the effects' slider moves. */
    readonly onEffectsVolumeChanged?: (volume: number) => void;
    /** Reported as the effects' icon is pressed. */
    readonly onEffectsIconPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows where an entry plays. It has a bar to leave the entry, pause it and
 * go fullscreen, the stage the entry fills, and the pause menu over it. It is
 * laid out even while closed, so the stage's size is known before an entry
 * starts, for the transition to aim at.
 */
export function RunnerView(bindings: RunnerViewBindings): Element {
    // Presentation state: whether the visitor has waved the turn-your-phone hint away
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
                musicVolume={bindings.musicVolume}
                effectsVolume={bindings.effectsVolume}
                onMusicVolumeChanged={bindings.onMusicVolumeChanged}
                onMusicIconPressed={bindings.onMusicIconPressed}
                onEffectsVolumeChanged={bindings.onEffectsVolumeChanged}
                onEffectsIconPressed={bindings.onEffectsIconPressed}
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
