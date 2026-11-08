import type { Container } from 'pixi.js';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import type { DemoModel } from '../models';
import { DiggerView } from './digger-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemoViewBindings {
    model: DemoModel;
    /** The chip the sound effects play on. */
    sfx: SfxChip<'audio90'>;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The whole demo: the digger at work, and the controls that set its level and speed. */
export function DemoView(bindings: DemoViewBindings): Container {
    const { model, sfx } = bindings;
    return DiggerView({ model: model.digger, sfx });
}
