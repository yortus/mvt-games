import type { PerformanceMeter, PerformanceMeterOptions } from '@mvtjs/utils';
import type { PerfmonFloatViewBindings } from './perfmon-float-view';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The Perfmon: its floating panel, and the meter that measures the page's frames for it. */
export interface Perfmon {
    /** The panel, which floats over the page. */
    readonly PerfmonFloatView: (bindings: PerfmonFloatViewBindings) => Element;
    /** Makes the meter the page's loop measures each frame with, while the panel is open. */
    readonly createPerformanceMeter: (options?: PerformanceMeterOptions) => PerformanceMeter;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Loads the Perfmon, and returns it. It loads separately from the page, the
 * first time it is opened, so the page's first load holds none of it: few
 * visitors open it. That is also why the views' barrel does not export its
 * parts.
 */
export async function loadPerfmon(): Promise<Perfmon> {
    const { PerfmonFloatView, createPerformanceMeter } = await import('./perfmon-float-view');
    return { PerfmonFloatView, createPerformanceMeter };
}
