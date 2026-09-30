import type { Container } from 'pixi.js';
import { createFrameStats, readCounter, updateScene } from '../../pixi-mvt';
import type { DemoEntry, DemoHost, DemoSession } from '../demo-entry';
import { createDemoModel, TANK_SIZES } from './models';
import { DEFAULT_VARIANTS, type DemoVariants, formatVariants, parseVariants } from './variants';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from './views';

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
            + 'flip the tank to set everything moving at once. Switches below the tank restart it '
            + 'with other implementations of the model and the view, to compare their cost.',
        techniques: [
            'One sprite per grain, projected by an index-addressed <List>',
            'Sleeping grains: simulation cost follows moving grains, refresh cost follows all grains',
            'Fixed-timestep cellular automaton, frame-rate independent and seeded',
            'Pointer input relayed to the model in domain units (cells)',
            'A domain-owned flip: the model turns the tank, the view just follows its angle',
            'Two implementations of one model interface: a record per grain, or a typed array per field',
            'Two views of the same grains: a sprite per grain, or a pixel per cell',
        ],
        sourceUrl: 'https://github.com/yortus/mvt-games/tree/main/src/demos/falling-sand',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 1500,

        start(stage: Container, host?: DemoHost): DemoSession {
            // In the gallery's runner, the variants come from the page's URL,
            // and a switch reloads the page with new ones. Started headless
            // (a thumbnail), the defaults, and switches that do nothing.
            const variants = host === undefined ? DEFAULT_VARIANTS : parseVariants(location.search);
            const restartWith = host === undefined ? undefined : restartPageWith;

            const model = createDemoModel({ ...TANK_SIZES[variants.tankSize], storage: variants.storage });
            const frameStats = host === undefined ? undefined : createFrameStats({ ...host, readCounter });
            const view = DemoView({
                model,
                grainsView: variants.grainsView,
                tankSize: variants.tankSize,
                frameStats: () => frameStats,
                onStoragePressed: restartWith && ((storage) => restartWith({ ...variants, storage })),
                onGrainsViewPressed: restartWith && ((grainsView) => restartWith({ ...variants, grainsView })),
                onTankSizePressed: restartWith && ((tankSize) => restartWith({ ...variants, tankSize })),
            });
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

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Reload the page with new variants in its URL. The runner relaunches the demo from its `#id`. */
function restartPageWith(variants: DemoVariants): void {
    location.assign(location.pathname + formatVariants(location.search, variants) + location.hash);
}
