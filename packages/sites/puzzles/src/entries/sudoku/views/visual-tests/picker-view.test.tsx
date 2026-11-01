import { Container, Graphics } from 'pixi.js';
import { canvasTest } from 'v-snap';
import { PickerView, type PickerViewBindings } from '../picker-view';
import { PAPER_COLOR, SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

// Closed, it draws nothing on the paper
canvasTest('closed', { ...SIZE, canBeBlank: true }, () => pose({ cell: () => -1 }));
canvasTest('open below a cell in the middle', SIZE, () => pose({ cell: () => 40 }));
canvasTest('open below a cell at the left edge, kept on screen', SIZE, () => pose({ cell: () => 9 }));
canvasTest('open above a cell in the bottom row, at the right edge', SIZE, () => pose({ cell: () => 80 }));
canvasTest('with the digit filled in lit', SIZE, () => pose({ cell: () => 40, digit: () => 6 }));

/** The picker on blank paper, with `overrides` for its bindings. */
function pose(overrides: Partial<PickerViewBindings>): Container {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(PAPER_COLOR));
    view.addChild(PickerView({ cell: () => 40, digit: () => 0, onChosen: () => undefined, onClosed: () => undefined, ...overrides }));
    return view;
}
