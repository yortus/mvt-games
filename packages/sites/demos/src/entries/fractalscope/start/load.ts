import { destroyElement } from '@mvtjs/html';
import { defineElementLoader, type ElementEntrySession } from '@mvtjs/site-kit/entry-types';
import { createDemoModel } from '../models';
import { DemoView } from '../views';
import '../fractalscope.css';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns how to start Fractalscope, which has no assets to load. It is
 * drawn with the DOM alone, with the image and the minimap on 2D canvases
 * and the panel in HTML. The host runs each frame the MVT way. The model
 * moves on, if a key is held. Then `updateView` computes a little more of the
 * picture, in the views' update step, and `refreshView` colours what changed
 * and draws it.
 */
export const load = defineElementLoader(async () => {
    return {
        kind: 'element',
        // Long enough for the picture at the rest setting to come out sharp
        thumbnailAdvanceMs: 1500,
        start({ element, takesInput }): ElementEntrySession {
            element.classList.add('fractalscope-host');
            const model = createDemoModel();
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
                    element.classList.remove('fractalscope-host');
                },
            };
        },
    };
});
