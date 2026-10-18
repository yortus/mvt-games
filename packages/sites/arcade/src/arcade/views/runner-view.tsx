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
    /** Whether the entry is paused. The pause menu shows while it is, but for while the entry's info panel is over it. */
    readonly isPaused: () => boolean;
    /** Whether the entry's info panel is open over it. The bar's (i) is lit while it is. */
    readonly isInfoOpen: () => boolean;
    /** Whether any sound is on, the music or the effects, and not muted. The bar's speaker is struck through when none is. */
    readonly isSoundOn: () => boolean;
    /** Whether all the sound is muted because the visit started that way, and the visitor has not changed it. A hint then offers to turn it on. */
    readonly isSoundOffByDefault: () => boolean;
    /** Whether the Perfmon is open. The bar's gauge is lit while it is. */
    readonly isPerfmonOpen: () => boolean;
    /** The music's volume, from 0 to 1. 0 is off. The pause menu shows it. */
    readonly musicVolume: () => number;
    /** The sound effects' volume, from 0 to 1. 0 is off. The pause menu shows it. */
    readonly effectsVolume: () => number;
    /** The chosen entry's name. */
    readonly title: () => string;
    /** Whether the entry's play area is wider than tall. On a phone held upright, a hint suggests turning it, unless the runner is turned for it. */
    readonly isLandscape: () => boolean;
    /** Whether the runner is turned a quarter turn, for a game wider than tall on a phone held upright. No hint is needed then. */
    readonly isTurned: () => boolean;
    /** Reported as the back button, or the pause menu's Exit, is pressed. */
    readonly onBackPressed?: () => void;
    /** Reported as the pause button is pressed while the entry runs. */
    readonly onPausePressed?: () => void;
    /** Reported as the bar's speaker, or the hint that the sound is off, is pressed. */
    readonly onSoundPressed?: () => void;
    /** Reported as the bar's gauge is pressed. */
    readonly onPerfmonPressed?: () => void;
    /** Reported as the bar's (i) is pressed, to open the entry's info panel, or close it. */
    readonly onInfoPressed?: () => void;
    /** Reported as the pause menu's Resume is pressed, or the pause button again while the entry is paused. */
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
 * Shows where an entry plays. It has a bar to leave the entry, pause it, go
 * fullscreen, turn the sound on or off, show the Perfmon and open the entry's
 * info panel, the stage the entry fills, and the pause menu over it. The bar
 * covers the site's nav, and is styled as the nav is: the speaker, the gauge
 * and the (i) sit where the nav's do. It is laid out even while closed, so
 * the stage's size is known before an entry starts, for the transition to
 * aim at.
 *
 * The entry's name comes first: where the bar is too narrow for the name and
 * every button, the buttons move into a menu (⋮) at the bar's end, until the
 * name fits: fullscreen first, then the gauge, the speaker and the (i).
 * Pause is the last to move. Where the name and
 * its buttons fit depends on the name, the bar's width and the font, so the
 * view measures them as the bar's size or the name changes, and keeps the
 * answer as its own state.
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
    // The bar's buttons, after the name, in order. Each one's rank says which stay in the bar where few fit: the first ranks stay
    const tools: readonly BarTool[] = [
        {
            name: 'Pause',
            rank: 0,
            label: () => (bindings.isPaused() ? 'Resume' : 'Pause'),
            classes: classesFor('runner-pause', 'is-on', bindings.isPaused),
            isPressed: bindings.isPaused,
            isDisabled: () => !bindings.isPlaying(),
            onPressed: togglePause,
        },
        ...(canFullscreen
            ? [{ name: 'Full screen', rank: 4, label: () => 'Full screen', classes: classesFor('runner-fullscreen', '', () => false), onPressed: toggleFullscreen }]
            : []),
        {
            name: 'Sound',
            rank: 2,
            label: () => (bindings.isSoundOn() ? 'Sound: on' : 'Sound: off'),
            classes: classesFor('runner-sound', 'is-off', () => !bindings.isSoundOn()),
            isPressed: bindings.isSoundOn,
            onPressed: () => bindings.onSoundPressed?.(),
        },
        {
            name: 'Performance',
            rank: 3,
            label: () => (bindings.isPerfmonOpen() ? 'Performance: shown' : 'Performance: hidden'),
            classes: classesFor('runner-perfmon', 'is-on', bindings.isPerfmonOpen),
            isPressed: bindings.isPerfmonOpen,
            onPressed: () => bindings.onPerfmonPressed?.(),
        },
        {
            name: 'About this entry',
            rank: 1,
            label: () => 'Info',
            classes: classesFor('runner-info', 'is-on', bindings.isInfoOpen),
            isPressed: bindings.isInfoOpen,
            onPressed: () => bindings.onInfoPressed?.(),
        },
    ];
    // Presentation state: how many of the buttons show in the bar, by rank. The rest are in its menu
    let shownCount = tools.length;
    // Presentation state: whether the menu is open
    let isMenuOpen = false;
    let bar: HTMLElement | undefined;
    let title: HTMLElement | undefined;
    let titleMeasure: HTMLElement | undefined;
    let moreButton: HTMLElement | undefined;
    const toolButtons: HTMLElement[] = [];
    const observer = new ResizeObserver(fitTools);
    window.addEventListener('pointerdown', onPagePointerDown, { capture: true });
    window.addEventListener('keydown', onPageKeyDown, { capture: true });

    return (
        <div class={runnerClass} onDestroyed={stopListening}>
            <header class="runner-bar" ref={(e) => observeBar(e)}>
                <button type="button" class="runner-back" aria-label="Back to the arcade" title="Back to the arcade" onClick={() => bindings.onBackPressed?.()} />
                <h2 class="runner-title" text={bindings.title} ref={(e) => { title = e; }} />
                {/* The name at its full width, unseen, for the view to measure */}
                <span
                    class="runner-title runner-title-measure"
                    aria-hidden="true"
                    text={bindings.title}
                    ref={(e) => observeTitle(e)}
                />
                {/* Pause and fullscreen, then the page's own tools and the (i), which sit where the nav's do */}
                {tools.map((tool) => (
                    <button
                        type="button"
                        class={tool.classes.bar}
                        aria-label={tool.name}
                        aria-pressed={tool.isPressed === undefined ? undefined : () => (tool.isPressed?.() === true ? 'true' : 'false')}
                        title={tool.label}
                        disabled={tool.isDisabled}
                        visible={() => tool.rank < shownCount}
                        ref={(e) => { toolButtons.push(e); }}
                        onClick={tool.onPressed}
                    />
                ))}
                <button
                    type="button"
                    class="runner-more"
                    aria-label="More"
                    title="More"
                    aria-haspopup="menu"
                    aria-expanded={() => (isMenuOpen ? 'true' : 'false')}
                    visible={() => shownCount < tools.length}
                    ref={(e) => { moreButton = e; }}
                    onClick={() => { isMenuOpen = !isMenuOpen; }}
                />
                <div class="runner-menu" role="menu" visible={() => isMenuOpen && shownCount < tools.length}>
                    {tools.map((tool) => (
                        <button
                            type="button"
                            role="menuitem"
                            class={tool.classes.menu}
                            disabled={tool.isDisabled}
                            visible={() => tool.rank >= shownCount}
                            onClick={() => {
                                isMenuOpen = false;
                                tool.onPressed();
                            }}
                        >
                            <span text={tool.label} />
                        </button>
                    ))}
                </div>
            </header>
            <div class="runner-frame">
                {bindings.stage}
            </div>
            <div class="runner-rotate-hint" visible={() => bindings.isPlaying() && bindings.isLandscape() && !bindings.isTurned() && !isHintDismissed}>
                <span text="Turn your phone sideways for a bigger view" />
                <button type="button" aria-label="Dismiss" text="×" onClick={() => { isHintDismissed = true; }} />
            </div>
            <div class="runner-sound-hint" visible={() => bindings.isPlaying() && bindings.isSoundOffByDefault() && !isSoundHintDismissed}>
                <button type="button" class="runner-sound-hint-text" text="Sound is off. Tap here to turn it on." onClick={() => bindings.onSoundPressed?.()} />
                <button type="button" aria-label="Dismiss" text="×" onClick={() => { isSoundHintDismissed = true; }} />
            </div>
            <PauseMenuView
                isOpen={() => bindings.isPaused() && !bindings.isInfoOpen()}
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

    /** The pause button pauses the entry, and pressed again, resumes it. */
    function togglePause(): void {
        if (bindings.isPaused()) bindings.onResumePressed?.();
        else bindings.onPausePressed?.();
    }

    /**
     * Works out how many buttons fit beside the entry's whole name, as the
     * bar's size or the name changes. The name and the buttons share the
     * room after the back button, and the menu's button takes one more
     * button's room when any move into it. It reads widths before any turn
     * (`offsetWidth`), as the bar is laid out.
     */
    function fitTools(): void {
        if (bar === undefined || title === undefined || titleMeasure === undefined || moreButton === undefined) return;
        const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
        let room = title.offsetWidth;
        let slot = 0;
        for (const button of [...toolButtons, moreButton]) {
            if (button.offsetWidth === 0) continue;
            room += button.offsetWidth + gap;
            slot = button.offsetWidth + gap;
        }
        if (slot === 0) return;
        // A pixel to spare, as the widths are rounded
        const nameWidth = titleMeasure.offsetWidth + 1;
        let fitting = 0;
        for (let count = tools.length; count > 0; count--) {
            const buttons = count < tools.length ? count + 1 : count;
            if (nameWidth + buttons * slot <= room) {
                fitting = count;
                break;
            }
        }
        shownCount = fitting;
        if (shownCount === tools.length) isMenuOpen = false;
    }

    function observeBar(e: HTMLElement): void {
        bar = e;
        observer.observe(e);
    }

    /** Watches the unseen copy of the name, whose width changes with the name. */
    function observeTitle(e: HTMLElement): void {
        titleMeasure = e;
        observer.observe(e);
    }

    /** A press anywhere but on the menu, or on its button, closes the menu. */
    function onPagePointerDown(e: PointerEvent): void {
        if (!isMenuOpen || !(e.target instanceof Node)) return;
        if (moreButton?.contains(e.target) === true || moreButton?.nextElementSibling?.contains(e.target) === true) return;
        isMenuOpen = false;
    }

    /** Escape closes the menu, and does nothing else: it reaches nothing that would pause or leave the entry. */
    function onPageKeyDown(e: KeyboardEvent): void {
        if (!isMenuOpen || e.key !== 'Escape') return;
        isMenuOpen = false;
        e.preventDefault();
        e.stopPropagation();
    }

    function stopListening(): void {
        observer.disconnect();
        window.removeEventListener('pointerdown', onPagePointerDown, { capture: true });
        window.removeEventListener('keydown', onPageKeyDown, { capture: true });
    }

    function runnerClass(): string {
        if (!bindings.isOpen()) return 'runner';
        return bindings.isPlaying() ? 'runner is-open is-playing' : 'runner is-open';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One of the bar's buttons, which shows in the bar or in its menu. */
interface BarTool {
    /** What it does, for assistive technology. */
    readonly name: string;
    /** Which stay in the bar where only some fit: the lowest. They run from 0, without a gap. */
    readonly rank: number;
    /** Its tooltip in the bar, and its label in the menu, which says how it stands. */
    readonly label: () => string;
    readonly classes: ToolClasses;
    /** Whether it is pressed, for a button that turns something on and off. */
    readonly isPressed?: () => boolean;
    readonly isDisabled?: () => boolean;
    readonly onPressed: () => void;
}

/** A button's classes, in the bar and in the menu, which give it its icon, and its state's look. */
interface ToolClasses {
    readonly bar: () => string;
    readonly menu: () => string;
}

/**
 * The classes of a button whose icon is `icon`, with `state` added while
 * `isInState` is true. Each is made once here, so a refresh builds no string.
 */
function classesFor(icon: string, state: string, isInState: () => boolean): ToolClasses {
    const bar = icon;
    const barInState = state === '' ? icon : `${icon} ${state}`;
    const menu = `runner-menu-item ${bar}`;
    const menuInState = `runner-menu-item ${barInState}`;
    return {
        bar: () => (isInState() ? barInState : bar),
        menu: () => (isInState() ? menuInState : menu),
    };
}

function toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
}
