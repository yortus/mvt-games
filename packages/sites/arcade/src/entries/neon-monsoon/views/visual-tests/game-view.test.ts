import { createHeadlessAudio90 } from 'audio90/headless';
import { advanceTime } from '@mvtjs/pixi';
import { canvasTest } from 'v-snap';
import { BOSS_ATTACKS, type StageEvent, textures } from '../../data';
import { createGameModel, type GameModel } from '../../models';
import { GameView } from '../game-view';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT };

canvasTest('locking onto a gunship', SIZE, () => poseVolley(600));
canvasTest('locked onto a gunship', SIZE, () => poseVolley(1200));
canvasTest('the volley speeding in', SIZE, () => poseVolley(1200, 500));

/** A gunship hanging still, up and to the left, firing nothing: something tough to lock onto. */
const GUNSHIP_AHEAD: readonly StageEvent[] = [
    { kind: 'spawn', atMs: 0, enemy: 'gunship', x: 70, y: 70, path: { kind: 'straight', speed: 0 }, patterns: [] },
];

/** The game with its volley charged, after the player has held Focus for `focusMs`, then let go for `afterMs`. */
async function poseVolley(focusMs: number, afterMs = 0) {
    await textures.load();
    const model = createGameModel({ events: GUNSHIP_AHEAD, bossAttacks: BOSS_ATTACKS });
    // A headless chip makes no sound, and an image does not depend on what plays.
    const view = GameView({ model, music: createHeadlessAudio90(), sfx: createHeadlessAudio90() });
    model.volley.addGrazeTime(Infinity);
    model.isFocusing = true;
    await advanceTime(focusMs, model, view);
    if (afterMs > 0) {
        letGoOfFocus(model);
        await advanceTime(afterMs, model, view);
    }
    return view;
}

/** What letting go of Focus does in the game: it stops focusing, and releases the volley. */
function letGoOfFocus(model: GameModel): void {
    model.isFocusing = false;
    model.releaseVolley();
}
