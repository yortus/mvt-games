import type { Container } from 'pixi.js';
import type { DemoModel } from '../models';
import { BoidsView } from './boids-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** The layout values are fixed: the entry rebuilds the view when the layout changes. */
export interface DemoViewBindings {
    readonly model: DemoModel;
    /** Width of the simulation area in pixels. */
    readonly simWidth: number;
    /** Height of the simulation area in pixels. */
    readonly simHeight: number;
    /** Whether the layout is portrait (controls below sim) or landscape (controls beside sim). */
    readonly isPortrait: boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The whole demo: the flock and its controls, wired to the demo's own settings. */
export function DemoView(bindings: DemoViewBindings): Container {
    const { model, simWidth, simHeight, isPortrait } = bindings;
    return BoidsView({
        model: model.flock,
        simWidth,
        simHeight,
        isPortrait,
        timeScale: () => model.timeScale,
        onTimeScaleChanged: (timeScale) => { model.timeScale = timeScale; },
        isShowingInfluences: () => model.isShowingInfluences,
        onShowInfluencesToggled: (isShowing) => { model.isShowingInfluences = isShowing; },
    });
}
