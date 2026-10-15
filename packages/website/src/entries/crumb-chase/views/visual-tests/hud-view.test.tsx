import { canvasTest } from 'v-snap';
import { HudView } from '../hud-view';
import { HUD_HEIGHT, SCREEN_WIDTH } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: HUD_HEIGHT };

canvasTest('a score', SIZE, () => HudView({ score: () => 1230, hint: '', width: SCREEN_WIDTH }));
// On a touch screen, the hint says how to steer
canvasTest('a score, with a hint', SIZE, () => HudView({ score: () => 1230, hint: 'Swipe to steer', width: SCREEN_WIDTH }));
