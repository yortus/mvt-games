import type { Container } from 'pixi.js';
import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createDemoModel, TANK_SIZES } from '../models';
import { DEFAULT_VARIANTS, type DemoVariants, formatVariants, parseVariants } from '../variants';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start the falling-sand demo, which has no assets to load. */
export const load = definePixiLoader(async () => {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        thumbnailAdvanceMs: 1500,

        start({ stage, isInPage, launchedBy }): EntrySession {
            // In a page, the variants come from the page's URL, and a switch
            // reloads the page with new ones. Launched by a showcase, a
            // reload would leave the showcase, so a switch restarts the demo
            // in place. Started headless, as for a thumbnail, it has the
            // defaults, and switches that don't do anything.
            let variants = isInPage === true ? parseVariants(location.search) : DEFAULT_VARIANTS;
            const restartWith = launchedBy !== undefined ? restartInPlaceWith : isInPage === true ? restartPageWith : undefined;
            let model = createDemoModel({ ...TANK_SIZES[variants.tankSize], storage: variants.storage });
            let view = createView();
            stage.addChild(view);

            return {
                // The host ticks the view with the rest of the stage
                update(deltaMs: number): void {
                    model.update(deltaMs);
                },
                destroy(): void {
                    stage.removeChild(view);
                    view.destroy({ children: true });
                },
            };

            function createView(): Container {
                return DemoView({
                    model,
                    grainsView: variants.grainsView,
                    tankSize: variants.tankSize,
                    onStoragePressed: restartWith && ((storage) => restartWith({ ...variants, storage })),
                    onGrainsViewPressed: restartWith && ((grainsView) => restartWith({ ...variants, grainsView })),
                    onTankSizePressed: restartWith && ((tankSize) => restartWith({ ...variants, tankSize })),
                });
            }

            /** Starts the demo afresh with new variants, in this page. */
            function restartInPlaceWith(next: DemoVariants): void {
                // After the press that asked for it has finished with the old view
                queueMicrotask(() => {
                    stage.removeChild(view);
                    view.destroy({ children: true });
                    variants = next;
                    model = createDemoModel({ ...TANK_SIZES[variants.tankSize], storage: variants.storage });
                    view = createView();
                    stage.addChild(view);
                });
            }
        },
    };
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Reload the page with new variants in its URL. The page relaunches the demo from its `#id`. */
function restartPageWith(variants: DemoVariants): void {
    location.assign(location.pathname + formatVariants(location.search, variants) + location.hash);
}
