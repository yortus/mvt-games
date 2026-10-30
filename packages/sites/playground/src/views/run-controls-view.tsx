/** @jsxImportSource @mvtjs/html */
import { createComputed } from '@mvtjs/utils';
import type { RunPhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RunControlsViewBindings {
    readonly phase: () => RunPhase;
    readonly isPaused: () => boolean;
    readonly speed: () => number;
    /** Whether a change runs the project again, once the files check clean. */
    readonly isRunOnChange: () => boolean;
    readonly onRunPressed?: () => void;
    readonly onStopPressed?: () => void;
    readonly onPausePressed?: () => void;
    readonly onResumePressed?: () => void;
    readonly onStepPressed?: () => void;
    readonly onSpeedChosen?: (speed: number) => void;
    readonly onRunOnChangeToggled?: (isOn: boolean) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Run, Stop, Pause or Resume, Step, the speed, whether a change runs it again, and where the run is. */
export function RunControlsView(bindings: RunControlsViewBindings): Element {
    const isLive = (): boolean => bindings.phase() === 'starting' || bindings.phase() === 'running';
    const speedValue = createComputed({ watch: bindings.speed, compute: String });

    return (
        <div class="run-controls">
            <button type="button" class="run-run" title="Run the project (Ctrl+Enter)" text="Run" onClick={() => bindings.onRunPressed?.()} />
            <button
                type="button"
                class="run-stop"
                text="Stop"
                disabled={() => bindings.phase() === 'idle' || bindings.phase() === 'stopped'}
                onClick={() => bindings.onStopPressed?.()}
            />
            <button
                type="button"
                class="run-pause"
                text={() => (bindings.isPaused() ? 'Resume' : 'Pause')}
                disabled={() => !isLive()}
                onClick={() => (bindings.isPaused() ? bindings.onResumePressed?.() : bindings.onPausePressed?.())}
            />
            <button
                type="button"
                class="run-step"
                title="Advance one frame"
                text="Step"
                disabled={() => !isLive() || !bindings.isPaused()}
                onClick={() => bindings.onStepPressed?.()}
            />
            <select class="run-speed" aria-label="Speed" value={speedValue} onChange={onSpeedChanged}>
                {SPEEDS.map((speed) => <option value={String(speed)} text={`${speed}x`} />)}
            </select>
            <label class="run-on-change" title="Run again half a second after the files stop changing, if they have no problems">
                <input
                    type="checkbox"
                    checked={bindings.isRunOnChange}
                    onChange={(event) => bindings.onRunOnChangeToggled?.((event.target as HTMLInputElement).checked)}
                />
                <span text="Run on change" />
            </label>
            <span class="run-phase" text={() => PHASE_LABELS[bindings.phase()]} />
        </div>
    );

    function onSpeedChanged(event: Event): void {
        bindings.onSpeedChosen?.(Number((event.target as HTMLSelectElement).value));
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SPEEDS = [0.25, 0.5, 1, 2, 4];

const PHASE_LABELS: Readonly<Record<RunPhase, string>> = {
    idle: 'Not run yet',
    preparing: 'Preparing...',
    starting: 'Starting...',
    running: 'Running',
    failed: 'Stopped by an error',
    stopped: 'Stopped',
};
