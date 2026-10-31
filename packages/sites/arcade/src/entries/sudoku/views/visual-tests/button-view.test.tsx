import { Container, Graphics } from 'pixi.js';
import { canvasTest } from 'v-snap';
import { ButtonView, type ButtonViewBindings } from '../button-view';
import { PAPER_COLOR } from '../view-constants';

const SIZE = { width: 180, height: 60, pixelArt: false };

canvasTest('unlit', SIZE, () => pose({}));
canvasTest('lit', SIZE, () => pose({ isLit: () => true }));
canvasTest('disabled', SIZE, () => pose({ isEnabled: () => false }));
canvasTest('lit and disabled', SIZE, () => pose({ isLit: () => true, isEnabled: () => false }));
canvasTest('with a large label', SIZE, () => pose({ label: '7', labelSize: 28 }));

/** A button on paper, with `overrides` for its bindings. */
function pose(overrides: Partial<ButtonViewBindings>): Container {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(PAPER_COLOR));
    view.addChild(ButtonView({
        x: 10, y: 8, width: 160, height: 44, label: 'Undo', isLit: () => false, isEnabled: () => true, onPressed: () => undefined,
        ...overrides,
    }));
    return view;
}
