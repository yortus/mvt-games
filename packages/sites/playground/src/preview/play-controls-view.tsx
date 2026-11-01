/** @jsxImportSource @mvtjs/html */

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PlayControlsViewBindings {
    readonly isPaused: () => boolean;
    /** How fast time runs in the project: 1 is real time. */
    readonly speed: () => number;
    /** Reported as Step is pressed, which pauses the run and moves it on one frame, or starts one, paused. */
    readonly onStepPressed?: () => void;
    /** Reported with a speed, as Slow, Normal or Fast is pressed, which carries on a paused run, or starts one. */
    readonly onSpeedPressed?: (speed: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The run's time, as four buttons in a row: Step, Slow, Normal and Fast. The
 * one in effect is marked. Step pauses the run, so there's no Pause button,
 * and pressing it again moves the run on one frame at a time. A speed
 * carries the run on from where it stood. With no run going, any of them
 * starts one, so there's no Play button.
 */
export function PlayControlsView(bindings: PlayControlsViewBindings): Element {
    return (
        <div class="play-controls" role="group" aria-label="Time">
            <button
                type="button"
                class={() => (bindings.isPaused() ? 'play-control play-control-active' : 'play-control')}
                title="Pause, and move on one frame"
                text="Step"
                aria-pressed={bindings.isPaused}
                onClick={() => bindings.onStepPressed?.()}
            />
            {SPEEDS.map(speedButton)}
        </div>
    );

    function speedButton(choice: SpeedChoice): Element {
        const isChosen = (): boolean => !bindings.isPaused() && bindings.speed() === choice.speed;
        return (
            <button
                type="button"
                class={() => (isChosen() ? 'play-control play-control-active' : 'play-control')}
                title={choice.title}
                text={choice.label}
                aria-pressed={isChosen}
                onClick={() => bindings.onSpeedPressed?.(choice.speed)}
            />
        );
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface SpeedChoice {
    readonly speed: number;
    readonly label: string;
    readonly title: string;
}

const SPEEDS: readonly SpeedChoice[] = [
    { speed: 0.25, label: 'Slow', title: 'Run at a quarter of the speed' },
    { speed: 1, label: 'Normal', title: 'Run in real time' },
    { speed: 2, label: 'Fast', title: 'Run at twice the speed' },
];
