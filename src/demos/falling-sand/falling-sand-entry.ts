import type { Container } from 'pixi.js';
import { createFrameStats } from '#common';
import { propReadCounter } from '#pixi-jsx';
import { updateScene } from '../../pixi-mvt';
import type { DemoEntry, DemoHost, DemoSession } from '../demo-entry';
import { TANK_COLS, TANK_ROWS } from './model-constants';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './view-constants';
import { createDemoModel } from './demo-model';
import { DemoView } from './demo-view';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFallingSandEntry(): DemoEntry {
    return {
        id: 'falling-sand',
        name: 'Falling Sand',
        description:
            'An aquarium of sand, water and walls, and a stress test for the MVT game loop. '
            + 'Every grain is its own item in the model and its own sprite in the view, so the '
            + 'refresh pass touches every grain in the tank every frame, while the simulation '
            + 'only touches the grains that are moving. Pour until the frame timings climb, then '
            + 'flip the tank to set everything moving at once.',
        techniques: [
            'One sprite per grain, projected by an index-addressed <List>',
            'Sleeping grains: simulation cost follows moving grains, refresh cost follows all grains',
            'Fixed-timestep cellular automaton, frame-rate independent and seeded',
            'Pointer input relayed to the model in domain units (cells)',
            'A domain-owned flip: the model turns the tank, the view just follows its angle',
        ],
        sourceUrl: 'https://github.com/yortus/mvt-games/tree/main/src/demos/falling-sand',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 1500,

        start(stage: Container, host?: DemoHost): DemoSession {
            const model = createDemoModel({ cols: TANK_COLS, rows: TANK_ROWS });
            const frameStats = host === undefined ? undefined : createFrameStats({ ...host, readCounter: propReadCounter });
            const view = DemoView({ model, frameStats: () => frameStats });
            stage.addChild(view);

            return {
                update(deltaMs: number): void {
                    model.update(deltaMs);
                    updateScene(view, deltaMs);
                },
                destroy(): void {
                    frameStats?.destroy();
                    stage.removeChild(view);
                    view.destroy({ children: true });
                },
            };
        },
    };
}
