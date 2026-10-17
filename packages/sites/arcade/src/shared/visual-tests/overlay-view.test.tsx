import { Container, Graphics } from 'pixi.js';
import { canvasTest } from 'v-snap';
import { OverlayView, type OverlayViewBindings } from '../overlay-view';

const SIZE = { width: 480, height: 336 };
const TEXT = 'BREEZY ACRES\nROUND 1\n\nFence off 70% of the meadow';

/** The overlay over a mid-green play area, so its dimmed backdrop shows. */
function poseOverlay(font: OverlayViewBindings['font']): Container {
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SIZE.width, SIZE.height).fill(0x5a7a4a));
    view.addChild(OverlayView({ font, width: SIZE.width, height: SIZE.height, isVisible: () => true, text: () => TEXT }));
    return view;
}

canvasTest('in the system font', SIZE, () => poseOverlay('system'));
// For an entry whose own text is in the pixel glyphs: in capitals, at a scale that follows the width
canvasTest('in the pixel glyphs', SIZE, () => poseOverlay('pixel'));
