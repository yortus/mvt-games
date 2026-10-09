import { describe } from 'vitest';
import { visualTest } from '#testing';
import { BUTTON_RADIUS } from './pixi-layout';
import { type SpinButtonMode, SpinButtonView } from './spin-button-view';

const MODES: readonly SpinButtonMode[] = ['spin', 'stop', 'disabled'];

describe('SpinButtonView', () => {
    // The held-down state comes from the pointer, not from bindings. So a
    // freshly built button is at rest.
    for (const mode of MODES) {
        visualTest(mode, () => SpinButtonView({ mode: () => mode, radius: BUTTON_RADIUS }), { artStyle: 'smooth' });
    }
});
