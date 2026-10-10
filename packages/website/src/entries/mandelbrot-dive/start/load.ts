import { destroyElement } from '@mvtjs/html';
import type { ElementEntrySession, ElementEntryStarter } from '../../../entry-types';
import { createExplorerModel } from '../models';
import { ExplorerView } from '../views';
import '../mandelbrot-dive.css';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns how to start the Mandelbrot dive, which has no assets to load. It
 * is drawn with the DOM alone: the image and the minimap on 2D canvases,
 * and the panel in HTML. The host runs each frame the MVT way: the model
 * computes a little more of the image, then `updateView` and `refreshView`
 * visit the views, which colour what changed and draw it.
 */
export async function load(): Promise<ElementEntryStarter> {
    return {
        kind: 'element',
        // Long enough for the home view to come out sharp
        thumbnailAdvanceMs: 1500,
        start({ element }): ElementEntrySession {
            element.classList.add('mandelbrot-dive-host');
            const model = createExplorerModel();
            const view = ExplorerView({ model });
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
                    element.classList.remove('mandelbrot-dive-host');
                },
            };
        },
    };
}
