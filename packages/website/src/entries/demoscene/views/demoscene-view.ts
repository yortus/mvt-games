import { Container } from 'pixi.js';
import type { ShowModel } from '../models';
import { ScreenView } from './screen-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemosceneViewBindings {
    model: ShowModel;
    /** Scanlines and a glow, as on a TV of the day. The glow needs a renderer. Read once. */
    hasCrt: boolean;
    /** Raster-time and sprite bars in the borders. Read once. */
    isDebug: boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The demo: the screen. The host's keys reach the show through the session's input config. */
export function DemosceneView(bindings: DemosceneViewBindings): Container {
    const { model, hasCrt, isDebug } = bindings;
    const view = new Container();
    view.label = 'demoscene';
    view.addChild(ScreenView({ model, hasScanlines: hasCrt, hasGlow: hasCrt, isDebug }));
    return view;
}
