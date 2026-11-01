import { definePixiProject } from 'playground';
import { createBoardModel } from './models';
import { GameView } from './views';

// The project: a board of gems, and a view of it on the stage. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: 640,
    height: 360,
    background: 0x111827,
    start: ({ stage }) => {
        const model = createBoardModel();
        stage.addChild(GameView({ model }));

        // So you can see a chain without clicking, the project makes three
        // matches in quick succession as it starts.
        const demo = [
            { atMs: 300, row: 1, col: 1 },
            { atMs: 800, row: 3, col: 5 },
            { atMs: 1300, row: 2, col: 3 },
        ];
        let elapsedMs = 0;
        return {
            update(deltaMs) {
                for (let i = 0; i < demo.length; i++) {
                    const { atMs, row, col } = demo[i];
                    if (elapsedMs < atMs && elapsedMs + deltaMs >= atMs) model.matchAt(row, col);
                }
                elapsedMs += deltaMs;
                model.update(deltaMs);
            },
        };
    },
});
