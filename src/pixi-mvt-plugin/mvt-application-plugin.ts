import { ExtensionType, extensions, type Application, type ApplicationOptions } from 'pixi.js';
import { createSceneScheduler } from './scene-scheduler';
import type { SceneScheduler, SchedulerStrategyKind } from './mvt-types';

// ---------------------------------------------------------------------------
// Type Augmentation
// ---------------------------------------------------------------------------

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace PixiMixins {
        interface Application {
            /**
             * Drives `onUpdate` / `onRefresh` over `app.stage`.
             *
             * Nothing subscribes this to `app.ticker`. Call `scene.update()` and
             * `scene.refresh()` from your own loop, in that order, so the frame
             * reads top to bottom in one place and a test can run the same two
             * calls without a ticker at all.
             */
            scene: SceneScheduler;
        }

        interface ApplicationOptions {
            /** Call-list strategy for `app.scene`. Defaults to `'incremental'`. */
            mvtStrategy?: SchedulerStrategyKind;
        }
    }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Application plugin exposing `app.scene`.
 *
 * This is the adapter half of the design and it is deliberately thin: it owns
 * the wiring between an `Application` and a scheduler, and nothing else. All
 * the behaviour lives in `createSceneScheduler`, which knows nothing about
 * `Application`, tickers or renderers.
 */
export const mvtScenePlugin = {
    extension: {
        type: ExtensionType.Application,
        name: 'mvtScene',
    },

    init(this: Application, options: Partial<ApplicationOptions>): void {
        const scheduler = createSceneScheduler(this.stage, { strategy: options.mvtStrategy });
        Object.defineProperty(this, 'scene', {
            value: scheduler,
            configurable: true,
            writable: false,
        });
    },

    destroy(this: Application): void {
        this.scene?.destroy();
        Reflect.deleteProperty(this, 'scene');
    },
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Registers {@link mvtScenePlugin} with Pixi. Idempotent. */
export function installMvtScenePlugin(): void {
    if (registered) return;
    registered = true;
    extensions.add(mvtScenePlugin);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

let registered = false;
