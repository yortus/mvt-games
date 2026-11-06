import type { Container } from 'pixi.js';
import type { DemoModel } from '../models';
import { TrackerView, type TrackerViewBindings } from './tracker-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemoViewBindings extends Omit<TrackerViewBindings, 'model'> {
    readonly model: DemoModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The whole demo: the tracker's screen, and the tunes it plays. */
export function DemoView(bindings: DemoViewBindings): Container {
    return TrackerView({ ...bindings, model: bindings.model.tracker });
}
