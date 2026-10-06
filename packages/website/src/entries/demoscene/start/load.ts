import type { EntrySession, PixiEntryStarter } from '../../../entry-types';
import { MS_PER_BAR } from '../data';
import { createShowModel } from '../models';
import { DemosceneView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Returns how to start the demoscene show, which has no assets to load. */
export async function load(): Promise<PixiEntryStarter> {
    return {
        kind: 'pixi',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // The logo part, landed and wobbling, with the border scroller running: half a bar
        // in, so the white flash on the bar's first beat has faded from the borders
        thumbnailAdvanceMs: MS_PER_BAR * 17.5,

        start({ stage, host }): EntrySession {
            // In a page, options come from the page's URL. Started headless
            // (a thumbnail, a benchmark), crisp pixels and no debug bars.
            const params = host === undefined ? undefined : new URLSearchParams(location.search);
            const model = createShowModel();
            const view = DemosceneView({
                model,
                hasCrt: params !== undefined && params.get('crt') !== 'off',
                isDebug: params !== undefined && params.has('debug'),
            });
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
                // Left and right skip between parts: the arrow keys, or the d-pad on a touch screen
                inputConfig: {
                    showDpad: true,
                    onXDirectionChanged: (direction) => {
                        if (direction !== 'none') model.skipParts(direction === 'left' ? -1 : 1);
                    },
                },
            };
        },
    };
}
