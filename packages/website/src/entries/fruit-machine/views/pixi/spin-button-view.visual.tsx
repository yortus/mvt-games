import { describe } from 'vitest';
import { canvasTest } from '@mvtjs/visual-testing';
import { BUTTON_RADIUS } from './pixi-layout';
import { type SpinButtonMode, SpinButtonView } from './spin-button-view';

const MODES: readonly SpinButtonMode[] = ['spin', 'stop', 'disabled'];

describe('SpinButtonView', () => {
    // The held-down state comes from the pointer, not from bindings. So a
    // freshly built button is at rest.
    for (const mode of MODES) {
        canvasTest(mode, { artStyle: 'smooth' }, () => SpinButtonView({ mode: () => mode, radius: BUTTON_RADIUS }));
    }
});
