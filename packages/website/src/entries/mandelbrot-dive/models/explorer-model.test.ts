import { describe, expect, it } from 'vitest';
import { HOME_SPAN } from '../data';
import { createExplorerModel, type ExplorerModel } from './explorer-model';
import { BASE_ITERATIONS, COARSEST_BLOCK, MAX_ITERATIONS, SETTLE_MS } from './model-constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stepMs(model: ExplorerModel, totalMs: number): void {
    for (let elapsed = 0; elapsed < totalMs; elapsed += 16) model.update(Math.min(16, totalMs - elapsed));
}

function createSizedModel(): ExplorerModel {
    const model = createExplorerModel();
    model.resize(160, 100);
    return model;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExplorerModel', () => {
    it('starts at home, computing the image there', () => {
        const model = createSizedModel();

        expect(model.zoom).toBe(1);
        expect(model.field.region).toEqual({ centerRe: model.region.centerRe, centerIm: model.region.centerIm, span: HOME_SPAN });
        expect(model.maxIterations).toBe(BASE_ITERATIONS);
        expect(model.palette).toBe('ember');
    });

    it('completes the overview and the image in a few frames', () => {
        const model = createSizedModel();
        stepMs(model, 500);

        expect(model.overview.isComplete).toBe(true);
        expect(model.field.isComplete).toBe(true);
    });

    it('sizes the image to what it is told', () => {
        const model = createExplorerModel();
        model.resize(300, 200);

        expect(model.field.cols).toBe(300);
        expect(model.field.rows).toBe(200);
    });

    it('moves the region at once, and holds the image until the gesture ends', () => {
        const model = createSizedModel();
        stepMs(model, 500);

        model.beginGesture();
        model.zoomBy(2, -0.6, 0);
        model.panBy(0.1, 0);
        stepMs(model, 1000);

        expect(model.region.span).toBeCloseTo(HOME_SPAN / 2);
        expect(model.field.region.span).toBe(HOME_SPAN);
        expect(model.field.isComplete).toBe(true);

        model.endGesture();
        model.update(16);

        expect(model.field.region.span).toBeCloseTo(HOME_SPAN / 2);
        expect(model.field.region.centerRe).toBeCloseTo(model.region.centerRe);
        expect(model.field.blockSize).toBeLessThanOrEqual(COARSEST_BLOCK);
    });

    it('waits for the wheel to settle before computing again', () => {
        const model = createSizedModel();
        stepMs(model, 500);

        // Notches, each within the settling time of the one before
        for (let i = 0; i < 5; i++) {
            model.zoomBy(1.25, -0.6, 0);
            stepMs(model, SETTLE_MS / 2);
        }
        expect(model.field.region.span).toBe(HOME_SPAN);

        stepMs(model, SETTLE_MS);
        expect(model.field.region.span).toBeCloseTo(model.region.span);
    });

    it('gives deeper views more iterations, up to a limit', () => {
        const model = createSizedModel();
        model.zoomBy(1000, -0.75, 0.1);
        stepMs(model, SETTLE_MS + 16);
        const deeper = model.maxIterations;

        expect(deeper).toBeGreaterThan(BASE_ITERATIONS);

        model.zoomBy(1e12, -0.75, 0.1);
        stepMs(model, SETTLE_MS + 16);
        expect(model.maxIterations).toBeGreaterThan(deeper);
        expect(model.maxIterations).toBeLessThanOrEqual(MAX_ITERATIONS);
    });

    it('goes home on reset, at once, keeping the palette', () => {
        const model = createSizedModel();
        model.choosePalette('ice');
        model.zoomBy(50, -0.75, 0.1);
        stepMs(model, SETTLE_MS + 16);

        model.reset();
        model.update(16);

        expect(model.zoom).toBe(1);
        expect(model.field.region.span).toBe(HOME_SPAN);
        expect(model.palette).toBe('ice');
    });

    it('takes a photo asked for once the image is finished', () => {
        const model = createSizedModel();
        model.requestPhoto();

        expect(model.isPhotoPending).toBe(true);
        expect(model.photosTaken).toBe(0);

        stepMs(model, 500);
        expect(model.isPhotoPending).toBe(false);
        expect(model.photosTaken).toBe(1);
    });

    it('takes one photo for requests made while one waits', () => {
        const model = createSizedModel();
        model.requestPhoto();
        model.requestPhoto();
        stepMs(model, 500);

        expect(model.photosTaken).toBe(1);
    });

    it('holds a photo until the image has caught up with the region', () => {
        const model = createSizedModel();
        stepMs(model, 500);
        model.requestPhoto();
        model.beginGesture();
        model.zoomBy(2, -0.6, 0);
        stepMs(model, 200);

        expect(model.photosTaken).toBe(0);

        model.endGesture();
        stepMs(model, 500);
        expect(model.photosTaken).toBe(1);
        expect(model.field.region.span).toBeCloseTo(HOME_SPAN / 2);
    });

    it('leaves the image alone after a gesture that moved nothing', () => {
        const model = createSizedModel();
        stepMs(model, 500);
        const revision = model.field.revision;
        model.beginGesture();
        model.panBy(0, 0);
        model.zoomBy(1, -0.6, 0);
        model.endGesture();
        stepMs(model, 100);

        expect(model.field.isComplete).toBe(true);
        expect(model.field.revision).toBe(revision);
    });

    it('does less work on a long frame, not more', () => {
        // Big enough that one frame finishes neither
        const steady = createExplorerModel();
        const slow = createExplorerModel();
        steady.resize(1000, 800);
        slow.resize(1000, 800);
        steady.update(16);
        slow.update(100);

        expect(slow.field.progress).toBeLessThan(steady.field.progress);
    });
});
