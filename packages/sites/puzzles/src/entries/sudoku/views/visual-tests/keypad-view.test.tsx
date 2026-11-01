import { Container, type FederatedPointerEvent, Graphics } from 'pixi.js';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { PAPER_COLOR } from '../../../../shared';
import { KeypadView } from '../keypad-view';
import { GRID_SIZE, KEY_HEIGHT } from '../view-constants';

// A key is held for 300 ms of the 450 a hold takes. Its ring shows nothing for the first 100, so it is part filled.

const SIZE = { width: GRID_SIZE + 20, height: KEY_HEIGHT + 20, pixelArt: false };

canvasTest('a key held, its ring filling, to fill the cell selected', SIZE, () => pose(0, 4));
canvasTest('the lit key held, its ring white, to clear the cell selected', SIZE, () => pose(1 << 4, 4));

/** The keypad on paper, lit for `digits`, with the key for `heldDigit` pressed and held. */
async function pose(digits: number, heldDigit: number): Promise<Container> {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(PAPER_COLOR));
    const keypad = KeypadView({
        digits: () => digits, isEnabled: () => true, canFill: () => true, onTapped: () => undefined, onHeld: () => undefined,
    });
    keypad.position.set(10, 10);
    view.addChild(keypad);
    (keypad.children[heldDigit - 1] as Container).emit('pointerdown', {} as FederatedPointerEvent);
    await advanceTime(300, view);
    return view;
}
