import { Container } from 'pixi.js';
import type { ArcadeControls } from '@mvtjs/site-kit/input';
import { ArcadeControlsInputView } from '@mvtjs/site-kit/input/pixi';
import type { DemoModel } from '../models';
import { TrackerView, type TrackerViewBindings } from './tracker-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemoViewBindings extends Omit<TrackerViewBindings, 'model'> {
    readonly model: DemoModel;
    /** The arcade controls, which the host passes to the demo as it starts. */
    readonly controls: ArcadeControls;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The whole demo: the tracker's screen, and the tunes it plays, with the keys wired to the tracker. */
export function DemoView(bindings: DemoViewBindings): Container {
    const { model, controls, ...trackerBindings } = bindings;
    const tracker = model.tracker;
    const view = new Container();
    view.addChild(
        // The d-pad moves the choice of tune, either way across or down, and the primary button plays or stops it
        ArcadeControlsInputView({
            controls,
            onXDirectionChanged: (direction) => {
                if (direction !== 'none') tracker.moveChoice(direction === 'left' ? -1 : 1);
            },
            onYDirectionChanged: (direction) => {
                if (direction !== 'none') tracker.moveChoice(direction === 'up' ? -1 : 1);
            },
            onPrimaryPressed: tracker.playOrStop,
        }),
        TrackerView({ ...trackerBindings, model: tracker }),
    );
    return view;
}
