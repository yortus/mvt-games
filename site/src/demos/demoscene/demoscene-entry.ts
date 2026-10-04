import type { Container } from 'pixi.js';
import type { DemoEntry, DemoHost, DemoSession } from '../demo-entry';
import { MS_PER_BAR } from './data';
import { createShowModel } from './models';
import { DemosceneView, SCREEN_HEIGHT, SCREEN_WIDTH } from './views';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDemosceneEntry(): DemoEntry {
    return {
        id: 'demoscene',
        name: 'MVT Megademo',
        description:
            'A looping show in the style of a 1980s C64 demo: raster bars, a bouncing and wobbling logo, '
            + 'a sine scroller in the border, plasma, filled vectors, 48 sprites at once and a credits roll. '
            + 'Every frame is drawn through a virtual video chip with the memory of an 8-bit home computer, '
            + 'so the limits are real: 16 colours, one colour per character cell, eight sprites to a line. '
            + 'The model is a clock and a script, and the view keeps no state of its own. '
            + 'Space pauses; the left and right cursor keys skip between parts. '
            + 'Add ?crt=off to the address for crisp pixels, or ?debug for raster-time bars.',
        techniques: [
            'A model that is a pure function of show time: seek, pause and thumbnails for free',
            'A view with no update step and no state: every frame drawn from scratch',
            'A virtual video chip whose memory layout carries the hardware\'s limits',
            'Per-line registers: raster bars, FLD, tech-tech and split screens',
            'A sprite multiplexer: 48 sprites through 8 hardware slots',
            'Pixel-buffer rendering: one texture uploaded per frame',
        ],
        sourceUrl: 'https://github.com/yortus/mvt-games/tree/main/site/src/demos/demoscene',
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        // The logo part, landed and wobbling, with the border scroller running
        thumbnailAdvanceMs: MS_PER_BAR * 17,

        start(stage: Container, host?: DemoHost): DemoSession {
            // In the gallery's runner, options come from the page's URL. Started
            // headless (a thumbnail, a benchmark), crisp pixels and no keys.
            const params = host === undefined ? undefined : new URLSearchParams(location.search);
            const model = createShowModel();
            const view = DemosceneView({
                model,
                hasCrt: params !== undefined && params.get('crt') !== 'off',
                isDebug: params !== undefined && params.has('debug'),
                hasKeys: host !== undefined,
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
            };
        },
    };
}
