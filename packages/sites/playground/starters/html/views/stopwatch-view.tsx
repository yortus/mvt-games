/** @jsxImportSource @mvtjs/html */
import { createComputed } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface StopwatchViewBindings {
    /** The time counted, in milliseconds. */
    readonly elapsedMs: () => number;
    readonly isRunning: () => boolean;
    readonly onStartOrStopPressed?: () => void;
    readonly onResetPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The time counted, large, as seconds and hundredths of a second, such as
 * 07:42, and buttons to start or stop and to reset. Each digit is as wide as
 * any other, so none moves as the time changes.
 */
export function StopwatchView(bindings: StopwatchViewBindings): Element {
    // The time's text is made again only when the hundredths shown change, not every frame
    const timeText = createComputed({ watch: () => Math.floor(bindings.elapsedMs() / 10), compute: formatTime });

    return (
        <div style="display: grid; justify-items: center; gap: 12px; padding: 24px;">
            <output
                style="font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 64px; font-variant-numeric: tabular-nums;"
                text={timeText}
            />
            <div style="display: flex; gap: 8px;">
                <button
                    type="button"
                    text={() => (bindings.isRunning() ? 'Stop' : 'Start')}
                    onClick={() => bindings.onStartOrStopPressed?.()}
                />
                <button type="button" text="Reset" onClick={() => bindings.onResetPressed?.()} />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns a time in hundredths of a second as the stopwatch shows it: 742 is 07:42. */
function formatTime(hundredths: number): string {
    return `${pad(Math.floor(hundredths / 100))}:${pad(hundredths % 100)}`;
}

/** A number with at least two digits: 7 is 07. */
function pad(value: number): string {
    return String(value).padStart(2, '0');
}
