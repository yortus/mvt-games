import { definePixiProject } from 'playground';
import { createRockFieldModel } from './models';
import { FieldView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

// The project: a field of rocks, a view of it, and audio views that play on
// the project's sound chip. The playground ticks what `start` returns, then
// updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0b1020,
    start: ({ stage, sound }) => {
        const model = createRockFieldModel();
        stage.addChild(FieldView({ model, sfx: sound, width: WIDTH, height: HEIGHT }));

        // So you can see the field thin out without clicking, the project
        // breaks three rocks as it starts.
        const demo = [
            { atMs: 400, x: 400, y: 70 },
            { atMs: 800, x: 300, y: 200 },
            { atMs: 1200, x: 580, y: 280 },
        ];
        let elapsedMs = 0;
        return {
            update(deltaMs) {
                for (let i = 0; i < demo.length; i++) {
                    const { atMs, x, y } = demo[i];
                    if (elapsedMs < atMs && elapsedMs + deltaMs >= atMs) model.breakRockAt(x, y);
                }
                elapsedMs += deltaMs;
                model.update(deltaMs);
            },
        };
    },
});
