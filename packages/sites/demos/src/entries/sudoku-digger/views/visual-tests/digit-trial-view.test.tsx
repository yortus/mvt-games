import { Container, Sprite, Texture } from 'pixi.js';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { DigitTrialView, type DigitTrialViewBindings } from '../digit-trial-view';
import { CELL_COLOR, CELL_SIZE } from '../view-constants';

// Each pose shows one cell, at twice its size so its small digits can be read. The cell held a 5, and a 2, a 7 and a
// 9 could go there instead.

const ZOOM = 2;
const SIZE = { width: CELL_SIZE * ZOOM, height: CELL_SIZE * ZOOM, pixelArt: false };
const RIVALS = toSet(2, 7, 9);

canvasTest('with no other digit that fits', SIZE, () => pose({ rivalDigits: () => 0 }));
canvasTest('trying the first rival', SIZE, () => pose({ testDigit: () => 2 }));
canvasTest('two rivals ruled out, trying the last', SIZE, () => pose({ ruledOutDigits: () => toSet(2, 7), testDigit: () => 9 }));
canvasTest('every rival ruled out', SIZE, () => pose({ ruledOutDigits: () => RIVALS, testDigit: () => 9 }));

// The first rival ruled out a moment ago, its stroke still being drawn
canvasTest('a stroke being drawn', SIZE, async () => {
    let ruledOut = 0;
    const view = pose({ ruledOutDigits: () => ruledOut, testDigit: () => 7 });
    await advanceTime(16, view);
    ruledOut = toSet(2);
    await advanceTime(60, view);
    return view;
});

/** The view on a cell's background, at twice its size, with `overrides` for the bindings. */
function pose(overrides: Partial<DigitTrialViewBindings>): Container {
    const view = new Container();
    view.scale.set(ZOOM);
    view.addChild(new Sprite({ texture: Texture.WHITE, width: CELL_SIZE, height: CELL_SIZE, tint: CELL_COLOR }));
    const trial = DigitTrialView({
        ownDigit: () => 5,
        rivalDigits: () => RIVALS,
        ruledOutDigits: () => 0,
        testDigit: () => 0,
        ...overrides,
    });
    trial.position.set(CELL_SIZE / 2, CELL_SIZE / 2);
    view.addChild(trial);
    return view;
}

/** The set of `digits`, with bit `d` set for each digit `d`. */
function toSet(...digits: number[]): number {
    let set = 0;
    for (const digit of digits) set |= 1 << digit;
    return set;
}
