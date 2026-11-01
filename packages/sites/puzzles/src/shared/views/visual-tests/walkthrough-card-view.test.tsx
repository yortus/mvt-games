import { Container, Graphics } from 'pixi.js';
import { canvasTest } from 'v-snap';
import { WalkthroughCardView, type WalkthroughCardViewBindings } from '../walkthrough-card-view';
import { PAPER_COLOR, SCREEN_WIDTH, WALKTHROUGH_HEIGHT, WALKTHROUGH_Y } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: WALKTHROUGH_Y + WALKTHROUGH_HEIGHT + 12, pixelArt: false };

canvasTest('at a step', SIZE, () => pose({}));
canvasTest('with text over two lines', SIZE, () => pose({
    text: () => 'Start a drag in the middle of the S cell, and drag through the cells to draw the path. This is a practice maze, so try anything.',
}));
canvasTest('at its last step, which plays', SIZE, () => pose({ stepNumber: () => 5, isAtLastStep: () => true, text: () => 'Have fun!' }));

/** The card on paper, with `overrides` for its bindings. */
function pose(overrides: Partial<WalkthroughCardViewBindings>): Container {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(PAPER_COLOR));
    view.addChild(WalkthroughCardView({
        stepNumber: () => 2, stepCount: () => 5, text: () => 'Tap two digits that could go in the cell.', isAtLastStep: () => false,
        onEnded: () => undefined,
        ...overrides,
    }));
    return view;
}
