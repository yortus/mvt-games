import { Container, Graphics } from 'pixi.js';
import { canvasTest } from 'v-snap';
import { TouchInputView } from '../touch-input-view';

/**
 * The controls drawn over a game that fills a canvas of this size, as a
 * showcase does, over a pale scene, so their dark backings show.
 */
function poseOverGame(width: number, height: number): Container {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, width, height).fill(0xe4e0d8));
    view.addChild(TouchInputView({
        canvasWidth: () => width,
        canvasHeight: () => height,
        gameX: () => 0,
        gameY: () => 0,
        gameWidth: () => width,
        gameHeight: () => height,
        scale: () => 1,
        isOverGame: () => true,
        hasDpad: () => true,
        dpadKind: () => 'four-way',
        hasPrimaryButton: () => true,
        hasSecondaryButton: () => false,
        primaryLabel: () => 'View',
        secondaryLabel: () => '',
        isJoystickFloating: () => false,
    }));
    return view;
}

// A phone held upright: the d-pad and the button in the bottom corners
canvasTest('over the game, upright', { width: 390, height: 616, pixelArt: false }, () => poseOverGame(390, 616));

// The same phone held sideways
canvasTest('over the game, sideways', { width: 664, height: 342, pixelArt: false }, () => poseOverGame(664, 342));
