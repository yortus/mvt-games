import { Assets, type Texture } from 'pixi.js';
import { definePixiLoader, type EntrySession } from '@mvtjs/site-kit/entry-types';
import { createLiveEntriesHost, fitShowcaseWidth } from '@mvtjs/site-kit/showcase';
import { GALLERY_ENTRIES, LIVE_OVER_MS, LIVE_START_DISTANCE, LIVE_STOP_DISTANCE, MAX_LIVE_PAINTINGS } from '../data';
import { createDemoModel } from '../models';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../views';
import { showcase } from './showcase';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns how to start the Gallery. It loads every demo's picture, for the
 * paintings, but none of their code. A demo's code loads as the visitor
 * comes near its painting.
 */
export const load = definePixiLoader(async () => {
    const thumbnails = await Promise.all(GALLERY_ENTRIES.map((each) => Assets.load<Texture>(each.thumbnail)));
    // The gallery lays itself out to fill the page's area, at its own height
    let viewWidth = SCREEN_WIDTH;

    return {
        kind: 'pixi',
        get screenWidth() {
            return viewWidth;
        },
        screenHeight: SCREEN_HEIGHT,
        fitTo(width, height) {
            viewWidth = fitShowcaseWidth({ areaWidth: width, areaHeight: height, height: SCREEN_HEIGHT });
        },
        // PixiJS 3D must be imported before the renderer starts. A demo on a painting draws with the gallery's renderer
        draws3d: true,
        arcadeControls: { showDpad: true, showPrimary: true, primaryLabel: 'View' },
        // A few steps along the first corridor, with the first paintings coming alive
        thumbnailAdvanceMs: 1500,
        thumbnailInput: (controls, elapsedMs) => {
            controls.setYDirection('script', elapsedMs < 700 ? 'up' : 'none');
        },

        start({ stage, overlay, controls, launcher }): EntrySession {
            const model = createDemoModel({ paintingCount: GALLERY_ENTRIES.length });
            // The paintings near the visitor run their demos, while the visitor walks
            const paintingHost = createLiveEntriesHost({
                showcaseId: showcase.id,
                entries: GALLERY_ENTRIES,
                launcher,
                distanceTo: (index) => {
                    // A painting's demo runs on through the glide in and out, and stops only while the launched demo plays over it
                    if (model.mode === 'viewing') return Infinity;
                    const painting = model.paintings[index];
                    return Math.hypot(painting.x - model.visitorX, painting.z - model.visitorZ);
                },
                maxLive: MAX_LIVE_PAINTINGS,
                startDistance: LIVE_START_DISTANCE,
                stopDistance: LIVE_STOP_DISTANCE,
                gameOverMs: LIVE_OVER_MS,
                indexInPlay: () => (model.mode === 'viewing' ? model.paintingInView?.index : undefined),
                onPlayEnded: model.stopViewing,
                // A demo that draws with the DOM runs on the overlay, laid over its painting
                overlay,
            });
            const view = DemoView({
                model,
                controls,
                entries: GALLERY_ENTRIES,
                thumbnails,
                liveAt: paintingHost.liveAt,
                playRectAt: paintingHost.playRectAt,
                // The views follow the width as it changes, so the session doesn't need a resize of its own
                viewWidth: () => viewWidth,
                overlay,
            });
            stage.addChild(view);

            return {
                // The paintings' demos are part of the gallery, so their models advance with the gallery's,
                // and their views tick with the gallery's scene, through their paintings
                update(deltaMs: number): void {
                    model.update(deltaMs);
                    paintingHost.update(deltaMs);
                },
                destroy(): void {
                    paintingHost.destroy();
                    stage.removeChild(view);
                    view.destroy({ children: true });
                },
            };
        },
    };
});
