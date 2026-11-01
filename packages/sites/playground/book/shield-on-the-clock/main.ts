import { definePixiProject } from 'playground';
import { createShieldModel, createTimeoutShieldModel } from './models';
import { ButtonView, ShieldView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

// Two shields side by side. The one on the left keeps time with setTimeout,
// and the one on the right with update(deltaMs). Both go up as the project
// starts, and the button raises both again. Pause the project with a shield
// up, wait a few seconds, and resume, to see which one waited for you.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0d1520,
    start: ({ stage }) => {
        const timeoutShield = createTimeoutShieldModel();
        const shield = createShieldModel();

        const left = ShieldView({ isRaised: () => timeoutShield.isRaised, label: 'setTimeout' });
        left.position.set(WIDTH * 0.28, 150);
        const right = ShieldView({ isRaised: () => shield.isRaised, label: 'update(deltaMs)' });
        right.position.set(WIDTH * 0.72, 150);

        const button = ButtonView({ label: 'raise()', width: BUTTON_WIDTH, onPressed: raiseBoth });
        button.position.set((WIDTH - BUTTON_WIDTH) / 2, 296);

        stage.addChild(left, right, button);
        raiseBoth();

        // Only this shield needs ticking. The other keeps its own time.
        return shield;

        function raiseBoth(): void {
            timeoutShield.raise();
            shield.raise();
        }
    },
});

const BUTTON_WIDTH = 140;
