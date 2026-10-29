import { canvasTest } from 'v-snap';
import { textures } from '../../data';
import { HudView } from '../hud-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT };

canvasTest('with the volley charging', SIZE, () => poseHud(0.4));
canvasTest('with the volley charged', SIZE, () => poseHud(1, true));
// A charged volley's bar shrinks as its ring loses shots, and still blinks
canvasTest('with the volley charged, and shots lost', SIZE, () => poseHud(0.75, true));

/** The HUD part way through a game, with a chain running and the volley's bar `volleyCharge` full. */
async function poseHud(volleyCharge: number, isVolleyCharged = false) {
    await textures.load();
    return HudView({
        score: () => 123_450,
        highScore: () => 500_000,
        lives: () => 3,
        bombs: () => 2,
        chain: () => 7,
        chainFraction: () => 0.6,
        volleyCharge: () => volleyCharge,
        isVolleyCharged: () => isVolleyCharged,
        loop: () => 1,
        stepCount: () => 0,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    });
}
