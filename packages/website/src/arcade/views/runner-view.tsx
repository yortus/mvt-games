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
    /** Whether any sound is on, the music or the effects, and not muted. The bar's speaker is struck through when none is. */
    readonly isSoundOn: () => boolean;
    /** Whether all the sound is muted because the visit started that way, and the visitor has not changed it. A hint then offers to turn it on. */
    readonly isSoundOffByDefault: () => boolean;
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
    /** Reported as the bar's speaker, or the hint that the sound is off, is pressed. */
    readonly onSoundPressed?: () => void;
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
 * Shows where an entry plays. It has a bar to leave the entry, turn the sound
 * on or off, pause it and go fullscreen, the stage the entry fills, and the
 * pause menu over it. It is laid out even while closed, so the stage's size
 * is known before an entry starts, for the transition to aim at.
 *
 * While the sound is off only because the visit started that way, a hint
 * under the speaker says so. Pressing the hint turns the sound on.
 */
export function RunnerView(bindings: RunnerViewBindings): Element {
    // Presentation state: whether the visitor has waved the turn-your-phone hint away
    let isHintDismissed = false;
    // Presentation state: whether the visitor has waved the sound-is-off hint away
    let isSoundHintDismissed = false;
    const canFullscreen = document.fullscreenEnabled;

    return (
        <div class={runnerClass}>
            <header class="runner-bar">
                <button type="button" class="runner-back" aria-label="Back to the arcade" title="Back to the arcade" text="←" onClick={() => bindings.onBackPressed?.()} />
                <h2 class="runner-title" text={bindings.title} />
                <button
                    type="button"
                    class={() => (bindings.isSoundOn() ? 'runner-sound' : 'runner-sound is-off')}
                    aria-label="Sound"
                    aria-pressed={() => (bindings.isSoundOn() ? 'true' : 'false')}
                    title={() => (bindings.isSoundOn() ? 'Sound: on' : 'Sound: off')}
                    onClick={() => bindings.onSoundPressed?.()}
                />
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
            <div class="runner-sound-hint" visible={() => bindings.isPlaying() && bindings.isSoundOffByDefault() && !isSoundHintDismissed}>
                <button type="button" class="runner-sound-hint-text" text="Sound is off. Tap here to turn it on." onClick={() => bindings.onSoundPressed?.()} />
                <button type="button" aria-label="Dismiss" text="×" onClick={() => { isSoundHintDismissed = true; }} />
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
