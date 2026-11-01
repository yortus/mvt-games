import { definePixiProject } from 'playground';
import { createPlayerModel } from './models';
import { GameView } from './views';

// The project: a player, and a view of their HUD on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: 640,
    height: 360,
    background: 0x111827,
    start: ({ stage }) => {
        const model = createPlayerModel();
        stage.addChild(GameView({ model }));

        // So you can see all three effects without pressing anything, the
        // project collects two coins, picks up a power-up and takes a hit,
        // in its first second or so.
        const demo = [
            { atMs: 200, act: model.collectCoin },
            { atMs: 500, act: model.pickUpPowerUp },
            { atMs: 800, act: model.collectCoin },
            { atMs: 1000, act: model.takeHit },
        ];
        let elapsedMs = 0;
        return {
            update(deltaMs) {
                for (let i = 0; i < demo.length; i++) {
                    if (elapsedMs < demo[i].atMs && elapsedMs + deltaMs >= demo[i].atMs) demo[i].act();
                }
                elapsedMs += deltaMs;
                model.update(deltaMs);
            },
        };
    },
});
