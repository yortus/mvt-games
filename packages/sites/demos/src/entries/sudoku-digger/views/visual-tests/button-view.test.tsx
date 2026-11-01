import { canvasTest } from 'v-snap';
import { ButtonView } from '../button-view';
import { BUTTON_HEIGHT, BUTTON_WIDTH } from '../view-constants';

const SIZE = { width: BUTTON_WIDTH, height: BUTTON_HEIGHT, pixelArt: false };

canvasTest('lit', SIZE, () => ButtonView({ x: 0, label: 'Normal', isLit: () => true, onPressed: () => {} }));
canvasTest('unlit', SIZE, () => ButtonView({ x: 0, label: 'Easiest', isLit: () => false, onPressed: () => {} }));
