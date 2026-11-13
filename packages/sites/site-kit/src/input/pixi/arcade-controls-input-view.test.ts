import { describe, expect, it } from 'vitest';
import { createArcadeControls } from '../arcade-controls';
import { ArcadeControlsInputView } from './arcade-controls-input-view';

describe('ArcadeControlsInputView', () => {
    it('reports a button as it changes, and as it is pressed', () => {
        const { controls, reports } = setup();
        controls.setHeld('script', 'primary', true);
        controls.setHeld('script', 'primary', false);
        controls.setHeld('script', 'restart', true);
        expect(reports).toEqual(['primary true', 'primary pressed', 'primary false', 'restart pressed']);
    });

    it('reports the d-pad\'s directions as they change', () => {
        const { controls, reports } = setup();
        controls.setXDirection('script', 'left');
        controls.setYDirection('script', 'down');
        expect(reports).toEqual(['x left', 'y down']);
    });

    it('reports nothing as it is created, even for a control already held, since a game view is created during a frame', async () => {
        const controls = createArcadeControls();
        controls.setHeld('script', 'primary', true);
        const { reports } = setup(controls);
        await Promise.resolve();
        expect(reports).toEqual([]);
    });

    it('reports nothing once destroyed, not even a release', async () => {
        const { controls, view, reports } = setup();
        controls.setHeld('script', 'secondary', true);
        view.destroy();
        await Promise.resolve();
        controls.setHeld('script', 'secondary', false);
        expect(reports).toEqual(['secondary true', 'secondary pressed']);
    });
});

/** Creates the view over `controls`, and keeps everything it reports, in order. */
function setup(controls = createArcadeControls()) {
    const reports: string[] = [];
    const view = ArcadeControlsInputView({
        controls,
        onXDirectionChanged: (direction) => reports.push(`x ${direction}`),
        onYDirectionChanged: (direction) => reports.push(`y ${direction}`),
        onPrimaryButtonChanged: (pressed) => reports.push(`primary ${pressed}`),
        onPrimaryPressed: () => reports.push('primary pressed'),
        onSecondaryButtonChanged: (pressed) => reports.push(`secondary ${pressed}`),
        onSecondaryPressed: () => reports.push('secondary pressed'),
        onRestartPressed: () => reports.push('restart pressed'),
    });
    return { controls, view, reports };
}
