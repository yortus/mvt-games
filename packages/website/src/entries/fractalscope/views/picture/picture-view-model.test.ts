import { describe, expect, it } from 'vitest';
import { REST_SETTINGS } from '../../data';
import { createScopeModel, type ScopeModel } from '../../models';
import { createPictureViewModel, type PictureViewModel } from './picture-view-model';
import { BASE_ITERATIONS, COARSEST_BLOCK, MAX_ITERATIONS, SETTLE_MS } from './picture-constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOME_SPAN = REST_SETTINGS['mandelbrot'].width;

function setup(cols = 160, rows = 100): { model: ScopeModel; picture: PictureViewModel } {
    const model = createScopeModel();
    const picture = createPictureViewModel({
        fractal: () => model.fractal,
        setting: () => model,
        magnification: () => model.magnification,
        restSetting: () => model.restSetting,
        measureEscape: model.measureEscape,
    });
    picture.resize(cols, rows);
    return { model, picture };
}

/** Advances the picture in frame-sized steps. */
function stepMs(picture: PictureViewModel, totalMs: number): void {
    for (let elapsed = 0; elapsed < totalMs; elapsed += 16) picture.update(Math.min(16, totalMs - elapsed));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PictureViewModel', () => {
    it('starts over the setting being looked at', () => {
        const { model, picture } = setup();

        expect(picture.image.setting).toEqual({ centreRe: model.centreRe, centreIm: model.centreIm, width: HOME_SPAN });
        expect(picture.image.maxIterations).toBe(BASE_ITERATIONS);
        expect(picture.overview.setting).toEqual(model.restSetting);
        expect(picture.palette).toBe('ember');
    });

    it('completes the overview and the picture in a few frames', () => {
        const { picture } = setup();
        stepMs(picture, 500);

        expect(picture.overview.isComplete).toBe(true);
        expect(picture.image.isComplete).toBe(true);
    });

    it('sizes the picture to what it is told', () => {
        const { picture } = setup(300, 200);

        expect(picture.image.cols).toBe(300);
        expect(picture.image.rows).toBe(200);
    });

    it('holds the picture while a gesture moves the setting, and follows once it ends', () => {
        const { model, picture } = setup();
        stepMs(picture, 500);

        picture.hold();
        model.magnifyAbout(2, -0.6, 0);
        model.moveCentre(0.1, 0);
        stepMs(picture, 1000);

        expect(model.width).toBeCloseTo(HOME_SPAN / 2);
        expect(picture.image.setting.width).toBe(HOME_SPAN);
        expect(picture.image.isComplete).toBe(true);

        picture.release();
        picture.update(16);

        expect(picture.image.setting.width).toBeCloseTo(HOME_SPAN / 2);
        expect(picture.image.setting.centreRe).toBeCloseTo(model.centreRe);
        expect(picture.image.blockSize).toBeLessThanOrEqual(COARSEST_BLOCK);
    });

    it('follows at once when a gesture ends between two frames', () => {
        const { model, picture } = setup();
        stepMs(picture, 500);

        // A flick: the whole gesture comes and goes before the next frame
        picture.hold();
        model.moveCentre(0.2, 0);
        picture.release();
        picture.update(16);

        expect(picture.image.setting.centreRe).toBeCloseTo(model.centreRe);
    });

    it('waits for the wheel to settle before computing again', () => {
        const { model, picture } = setup();
        stepMs(picture, 500);

        // Notches, each within the settling time of the one before
        for (let i = 0; i < 5; i++) {
            model.magnifyAbout(1.25, -0.6, 0);
            stepMs(picture, SETTLE_MS / 2);
        }
        expect(picture.image.setting.width).toBe(HOME_SPAN);

        stepMs(picture, SETTLE_MS);
        expect(picture.image.setting.width).toBeCloseTo(model.width);
    });

    it('gives deeper views more iterations, up to a limit', () => {
        const { model, picture } = setup();
        model.magnifyAbout(1000, -0.75, 0.1);
        stepMs(picture, SETTLE_MS + 16);
        const deeper = picture.image.maxIterations;

        expect(deeper).toBeGreaterThan(BASE_ITERATIONS);

        model.magnifyAbout(1e12, -0.75, 0.1);
        stepMs(picture, SETTLE_MS + 16);
        expect(picture.image.maxIterations).toBeGreaterThan(deeper);
        expect(picture.image.maxIterations).toBeLessThanOrEqual(MAX_ITERATIONS);
    });

    it('starts again from nothing, at once, when the fractal changes', () => {
        // Big enough that one frame does not finish the new picture
        const { model, picture } = setup(1000, 800);
        stepMs(picture, 500);
        model.magnifyAbout(10, -0.75, 0.1);

        model.chooseFractal('burning-ship');
        picture.update(16);

        const home = REST_SETTINGS['burning-ship'];
        expect(picture.image.setting).toEqual({ centreRe: home.centreRe, centreIm: home.centreIm, width: home.width });
        expect(picture.image.isComplete).toBe(false);
        expect(picture.overview.setting).toEqual(home);
        expect(picture.image.maxIterations).toBe(BASE_ITERATIONS);

        stepMs(picture, 3000);
        expect(picture.image.isComplete).toBe(true);
        expect(picture.overview.isComplete).toBe(true);
    });

    it('leaves the picture alone after a gesture that moved nothing', () => {
        const { model, picture } = setup();
        stepMs(picture, 500);
        const revision = picture.image.revision;
        picture.hold();
        model.moveCentre(0, 0);
        model.magnifyAbout(1, -0.6, 0);
        picture.release();
        stepMs(picture, 100);

        expect(picture.image.isComplete).toBe(true);
        expect(picture.image.revision).toBe(revision);
    });

    it('does less work on a long frame, not more', () => {
        // Big enough that one frame finishes neither
        const steady = setup(1000, 800).picture;
        const slow = setup(1000, 800).picture;
        steady.update(16);
        slow.update(100);

        expect(slow.image.progress).toBeLessThan(steady.image.progress);
    });

    it('keeps the palette chosen', () => {
        const { model, picture } = setup();
        picture.choosePalette('ice');
        model.recentre();
        model.chooseFractal('tricorn');
        picture.update(16);

        expect(picture.palette).toBe('ice');
    });

    it('takes a photo asked for once the picture is finished', () => {
        const { picture } = setup();
        picture.requestPhoto();

        expect(picture.isPhotoPending).toBe(true);
        expect(picture.photosTaken).toBe(0);

        stepMs(picture, 500);
        expect(picture.isPhotoPending).toBe(false);
        expect(picture.photosTaken).toBe(1);
    });

    it('takes one photo for requests made while one waits', () => {
        const { picture } = setup();
        picture.requestPhoto();
        picture.requestPhoto();
        stepMs(picture, 500);

        expect(picture.photosTaken).toBe(1);
    });

    it('holds a photo until the picture has caught up with the setting', () => {
        const { model, picture } = setup();
        stepMs(picture, 500);
        picture.requestPhoto();
        picture.hold();
        model.magnifyAbout(2, -0.6, 0);
        stepMs(picture, 200);

        expect(picture.photosTaken).toBe(0);

        picture.release();
        stepMs(picture, 500);
        expect(picture.photosTaken).toBe(1);
        expect(picture.image.setting.width).toBeCloseTo(HOME_SPAN / 2);
    });
});
