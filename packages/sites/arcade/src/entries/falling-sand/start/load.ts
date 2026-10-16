import { createPerformanceMetrics } from '@mvtjs/pixi';
import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { createDemoModel, TANK_SIZES } from '../models';
import { DEFAULT_VARIANTS, type DemoVariants, formatVariants, parseVariants } from '../variants';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start the falling-sand demo, which has no assets to load. */
export async function load(): Promise<PixiEntryStarter> {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 1500,

        start({ stage, host }): EntrySession {
            // In a page, the variants come from the page's URL,
            // and a switch reloads the page with new ones. Started headless
            // (a thumbnail), the defaults, and switches that do nothing.
            const variants = host === undefined ? DEFAULT_VARIANTS : parseVariants(location.search);
            const restartWith = host === undefined ? undefined : restartPageWith;

            const model = createDemoModel({ ...TANK_SIZES[variants.tankSize], storage: variants.storage });
            const performanceMetrics = host === undefined ? undefined : createPerformanceMetrics(host);
            const view = DemoView({
                model,
                grainsView: variants.grainsView,
                tankSize: variants.tankSize,
                performanceMetrics: () => performanceMetrics,
                onStoragePressed: restartWith && ((storage) => restartWith({ ...variants, storage })),
                onGrainsViewPressed: restartWith && ((grainsView) => restartWith({ ...variants, grainsView })),
                onTankSizePressed: restartWith && ((tankSize) => restartWith({ ...variants, tankSize })),
            });
            stage.addChild(view);

            return {
                // The host ticks the view with the rest of the stage
                update(deltaMs: number): void {
                    model.update(deltaMs);
                },
                destroy(): void {
                    performanceMetrics?.destroy();
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

/** Reload the page with new variants in its URL. The page relaunches the demo from its `#id`. */
function restartPageWith(variants: DemoVariants): void {
    location.assign(location.pathname + formatVariants(location.search, variants) + location.hash);
}
