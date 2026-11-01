/** @jsxImportSource @mvtjs/html */
import type { RunPhase } from '../models';
import { PlayControlsView } from '../preview';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RunControlsViewBindings {
    readonly phase: () => RunPhase;
    readonly isPaused: () => boolean;
    readonly speed: () => number;
    /** Reported as Restart is pressed, which runs the project again from the start. */
    readonly onRestartPressed?: () => void;
    /** Reported as Step is pressed, which pauses the run and moves it on one frame. */
    readonly onStepPressed?: () => void;
    /** Reported with a speed, as Slow, Normal or Fast is pressed. */
    readonly onSpeedPressed?: (speed: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Step, Slow, Normal and Fast, and at the right, Restart, or while a run
 * gets going, a note that it is. A run that's going needs no note, since
 * the preview shows it, and one an error stopped has its error in the
 * console.
 */
export function RunControlsView(bindings: RunControlsViewBindings): Element {
    return (
        <div class="run-controls">
            <PlayControlsView
                isPaused={bindings.isPaused}
                speed={bindings.speed}
                onStepPressed={bindings.onStepPressed}
                onSpeedPressed={bindings.onSpeedPressed}
            />
            <button
                type="button"
                class="run-restart"
                title="Run it again from the start (Ctrl+Enter)"
                text="Restart"
                visible={() => !isStarting()}
                onClick={() => bindings.onRestartPressed?.()}
            />
            <span class="run-phase" text={() => (bindings.phase() === 'preparing' ? 'Preparing...' : 'Starting...')} visible={isStarting} />
        </div>
    );

    function isStarting(): boolean {
        return bindings.phase() === 'preparing' || bindings.phase() === 'starting';
    }
}
