import { definePixiProject } from 'playground';
import { createGameModel } from './models';
import { GameView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

// The project: a ship and a rock, a view of them, and an audio view that
// plays on the project's sound chip. The playground ticks what `start`
// returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0b1020,
    start: ({ stage, sound }) => {
        const model = createGameModel({ width: WIDTH, height: HEIGHT });
        stage.addChild(GameView({ model, sfx: sound, width: WIDTH, height: HEIGHT }));

        // So you can see shots without clicking, the ship fires three as
        // the project starts.
        const demoShotsMs = [1000, 1200, 1400];
        let elapsedMs = 0;
        return {
            update(deltaMs) {
                for (let i = 0; i < demoShotsMs.length; i++) {
                    if (elapsedMs < demoShotsMs[i] && elapsedMs + deltaMs >= demoShotsMs[i]) model.fire();
                }
                elapsedMs += deltaMs;
                model.update(deltaMs);
            },
        };
    },
});
