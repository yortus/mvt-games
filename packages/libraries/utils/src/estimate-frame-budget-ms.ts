import type { PerformanceMetrics } from './performance-history';

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * The time a frame has on this display, in milliseconds: one frame at the
 * highest rate in the recent history, rounded to the nearest common refresh
 * rate. A game that keeps up runs at the display's rate, so the highest rate
 * it reached is the display's, even after it slows. Without any history to go
 * by, it's a frame at 60 FPS.
 */
export function estimateFrameBudgetMs(metrics: PerformanceMetrics | undefined): number {
    if (metrics === undefined) return DEFAULT_BUDGET_MS;
    let peakFps = 0;
    for (let i = 0; i < metrics.historyLength; i++) {
        const fps = metrics.historyAt('fps', i);
        if (fps > peakFps) peakFps = fps;
    }
    if (peakFps === 0) return DEFAULT_BUDGET_MS;
    let rate = REFRESH_RATES[0];
    for (let i = 1; i < REFRESH_RATES.length; i++) {
        if (Math.abs(REFRESH_RATES[i] - peakFps) < Math.abs(rate - peakFps)) rate = REFRESH_RATES[i];
    }
    return 1000 / rate;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The frame budget before there is a frame rate to go by: 60 FPS. */
const DEFAULT_BUDGET_MS = 1000 / 60;

/** The refresh rates displays commonly run at, in frames per second, which a measured rate is rounded to. */
const REFRESH_RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 175, 240, 360];
