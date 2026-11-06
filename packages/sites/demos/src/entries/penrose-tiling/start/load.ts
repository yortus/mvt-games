import { destroyElement } from '@mvtjs/html';
import { defineElementLoader, type ElementEntrySession } from '@mvtjs/site-kit/entry-types';
import { createDemoModel } from '../models';
import { DemoView } from '../views';
import '../penrose-tiling.css';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns how to start Penrose Tiling, which has no assets to load. It is
 * drawn with the DOM alone: the tiling on a 2D canvas, and the panel in
 * HTML. The host runs each frame the MVT way. The model moves on and lays the
 * tiles, `updateView` moves the look on, and `refreshView` draws the tiles and
 * moves the sliders.
 */
export const load = defineElementLoader(async () => {
    return {
        kind: 'element',
        start({ element, takesInput }): ElementEntrySession {
            element.classList.add('penrose-tiling-host');
            const model = createDemoModel({});
            const view = DemoView({ model, takesKeys: takesInput === true });
            element.append(view);

            return {
                views: [view],
                update(deltaMs: number): void {
                    model.update(deltaMs);
                },
                render(): void {
                    // The page is the renderer: the views draw as they refresh.
                },
                destroy(): void {
                    destroyElement(view);
                    element.replaceChildren();
                    element.classList.remove('penrose-tiling-host');
                },
            };
        },
    };
});
