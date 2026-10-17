import { Container, Graphics } from 'pixi.js';
import { canvasTest } from 'v-snap';
import { PixelTextView, type PixelTextViewBindings } from '../pixel-text-view';

const SIZE = { width: 160, height: 60 };

/** The text on a mid-green ground, with its origin at (`x`, `y`) marked by a red pixel. */
function poseText(bindings: PixelTextViewBindings, x: number, y: number): Container {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(0x5a7a4a));
    const text = PixelTextView(bindings);
    text.position.set(x, y);
    view.addChild(text, new Graphics().rect(x, y, 1, 1).fill(0xff0000));
    return view;
}

// Lower case is set in capitals, from the origin at the text's top left
canvasTest('in capitals, at its own size', SIZE, () => poseText({ text: 'Score: 1230', color: 0xffffff }, 4, 4));
canvasTest('twice its size, with a shadow', SIZE, () => poseText({ text: 'Round 2', color: 0xffe08a, shadow: 0x3a2a10, scale: 2 }, 4, 4));
// The origin in the middle of the text, across and down
canvasTest('outlined, and centred on its origin', SIZE, () => poseText({ text: '+500', color: 0xffffff, outline: 0x24180d, scale: 2, anchorX: 0.5, anchorY: 0.5 }, 80, 30));
// Each line centred, and a blank line kept
canvasTest('on several lines, centred', SIZE, () => poseText({ text: 'GAME OVER\n\nPress Enter', color: 0xffffff, anchorX: 0.5 }, 80, 4));
// Too wide at three times its size for the width given, so drawn at twice
canvasTest('at a smaller scale where it is too wide', SIZE, () => poseText({ text: 'WAVE CLEAR!', color: 0xffffff, scale: 3, maxWidth: 150, anchorX: 0.5 }, 80, 4));
