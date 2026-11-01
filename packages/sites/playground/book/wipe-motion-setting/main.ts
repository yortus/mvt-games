import { definePixiProject } from 'playground';
import { createLevelModel } from './models';
import { GameView } from './views';

// The project: a game of levels, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: 640,
    height: 360,
    background: 0x111827,
    start: ({ stage }) => {
        const model = createLevelModel();

        // The page reads the player's setting for less motion, and the
        // switch on the screen changes it, as a game's own options would.
        // The model never sees it. It reaches the views as a getter, so they
        // follow it as it changes.
        const settings = { isMotionReduced: readSystemSetting() };
        stage.addChild(GameView({
            model,
            isMotionReduced: () => settings.isMotionReduced,
            onMotionSwitchToggled: () => {
                settings.isMotionReduced = !settings.isMotionReduced;
            },
        }));
        return model;
    },
});

/** Whether the system asks for less motion. Outside a browser, as in a test, there's no system setting to read. */
function readSystemSetting(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
