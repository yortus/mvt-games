import { describe, expect, it } from 'vitest';
import { advanceTime } from '@mvtjs/html';
import { MIN_RECENTRE_MS, REST_SETTINGS, TRAVEL_RATE } from '../../data';
import { createScopeModel, type ScopeModel } from '../../models';
import { createPictureViewModel, type PictureViewModel } from './picture-view-model';
import { BASE_ITERATIONS, COARSEST_BLOCK, MAX_ITERATIONS, MAX_SLIDE_SHARE, MAX_STALE_MS, SETTLE_MS } from './picture-constants';
import { UNKNOWN } from './reproject-samples';

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
        isScopeMoving: () => model.isMoving,
        measureEscape: model.measureEscape,
    });
    picture.resize(cols, rows);
    return { model, picture };
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

    it('completes the overview and the picture in a few frames', async () => {
        const { picture } = setup();
        await advanceTime(500, picture);

        expect(picture.overview.isComplete).toBe(true);
        expect(picture.image.isComplete).toBe(true);
    });

    it('sizes the picture to what it is told', () => {
        const { picture } = setup(300, 200);

        expect(picture.image.cols).toBe(300);
        expect(picture.image.rows).toBe(200);
    });

    it('holds the picture while a gesture moves the setting, and follows once it ends', async () => {
        const { model, picture } = setup();
        await advanceTime(500, picture);

        picture.hold();
        model.magnifyAbout(2, -0.6, 0);
        model.moveCentre(0.1, 0);
        await advanceTime(1000, picture);

        expect(model.width).toBeCloseTo(HOME_SPAN / 2);
        expect(picture.image.setting.width).toBe(HOME_SPAN);
        expect(picture.image.isComplete).toBe(true);

        picture.release();
        picture.update(16);

        expect(picture.image.setting.width).toBeCloseTo(HOME_SPAN / 2);
        expect(picture.image.setting.centreRe).toBeCloseTo(model.centreRe);
        expect(picture.image.blockSize).toBeLessThanOrEqual(COARSEST_BLOCK);
    });

    it('follows at once when a gesture ends between two frames', async () => {
        const { model, picture } = setup();
        await advanceTime(500, picture);

        // A flick: the whole gesture comes and goes before the next frame
        picture.hold();
        model.moveCentre(0.2, 0);
        picture.release();
        picture.update(16);

        expect(picture.image.setting.centreRe).toBeCloseTo(model.centreRe);
    });

    it('waits for the wheel to settle before computing again', async () => {
        const { model, picture } = setup();
        await advanceTime(500, picture);

        // Notches, each within the settling time of the one before
        for (let i = 0; i < 5; i++) {
            model.magnifyAbout(1.25, -0.6, 0);
            await advanceTime(SETTLE_MS / 2, picture);
        }
        expect(picture.image.setting.width).toBe(HOME_SPAN);

        await advanceTime(SETTLE_MS, picture);
        expect(picture.image.setting.width).toBeCloseTo(model.width);
    });

    it('gives deeper views more iterations, up to a limit', async () => {
        const { model, picture } = setup();
        model.magnifyAbout(1000, -0.75, 0.1);
        await advanceTime(SETTLE_MS + 16, picture);
        const deeper = picture.image.maxIterations;

        expect(deeper).toBeGreaterThan(BASE_ITERATIONS);

        model.magnifyAbout(1e12, -0.75, 0.1);
        await advanceTime(SETTLE_MS + 16, picture);
        expect(picture.image.maxIterations).toBeGreaterThan(deeper);
        expect(picture.image.maxIterations).toBeLessThanOrEqual(MAX_ITERATIONS);
    });

    it('starts again from nothing, at once, when the fractal changes', async () => {
        // Big enough that one frame does not finish the new picture
        const { model, picture } = setup(1000, 800);
        await advanceTime(500, picture);
        model.magnifyAbout(10, -0.75, 0.1);

        model.chooseFractal('burning-ship');
        picture.update(16);

        const home = REST_SETTINGS['burning-ship'];
        expect(picture.image.setting).toEqual({ centreRe: home.centreRe, centreIm: home.centreIm, width: home.width });
        expect(picture.image.isComplete).toBe(false);
        expect(picture.overview.setting).toEqual(home);
        expect(picture.image.maxIterations).toBe(BASE_ITERATIONS);

        await advanceTime(3000, picture);
        expect(picture.image.isComplete).toBe(true);
        expect(picture.overview.isComplete).toBe(true);
    });

    it('leaves the picture alone after a gesture that moved nothing', async () => {
        const { model, picture } = setup();
        await advanceTime(500, picture);
        const version = picture.image.version;
        picture.hold();
        model.moveCentre(0, 0);
        model.magnifyAbout(1, -0.6, 0);
        picture.release();
        await advanceTime(100, picture);

        expect(picture.image.isComplete).toBe(true);
        expect(picture.image.version).toBe(version);
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
        model.chooseFractal('circle-lace');
        picture.update(16);

        expect(picture.palette).toBe('ice');
    });

    it('takes a photo asked for once the picture is finished', async () => {
        const { picture } = setup();
        picture.requestPhoto();

        expect(picture.isPhotoPending).toBe(true);
        expect(picture.photosTaken).toBe(0);

        await advanceTime(500, picture);
        expect(picture.isPhotoPending).toBe(false);
        expect(picture.photosTaken).toBe(1);
    });

    it('takes one photo for requests made while one waits', async () => {
        const { picture } = setup();
        picture.requestPhoto();
        picture.requestPhoto();
        await advanceTime(500, picture);

        expect(picture.photosTaken).toBe(1);
    });

    it('holds a photo until the picture has caught up with the setting', async () => {
        const { model, picture } = setup();
        await advanceTime(500, picture);
        picture.requestPhoto();
        picture.hold();
        model.magnifyAbout(2, -0.6, 0);
        await advanceTime(200, picture);

        expect(picture.photosTaken).toBe(0);

        picture.release();
        await advanceTime(500, picture);
        expect(picture.photosTaken).toBe(1);
        expect(picture.image.setting.width).toBeCloseTo(HOME_SPAN / 2);
    });

    it('keeps up with a scope that a held control never stops moving', () => {
        const { model, picture } = setup();
        model.travelRe = 1;
        const stepMs = 16;
        let furthestBehind = 0;
        for (let elapsedMs = 0; elapsedMs < MAX_STALE_MS * 8; elapsedMs += stepMs) {
            model.update(stepMs);
            picture.update(stepMs);
            furthestBehind = Math.max(furthestBehind, model.centreRe - picture.image.setting.centreRe);
        }

        // It may lag by what the scope covers in that time, and a frame more.
        const travelledInTime = TRAVEL_RATE * HOME_SPAN * (MAX_STALE_MS + stepMs) / 1000;
        expect(furthestBehind).toBeGreaterThan(0);
        expect(furthestBehind).toBeLessThanOrEqual(travelledInTime);
    });

    it('takes the picture again every frame while the scope zooms out by itself', () => {
        const { model, picture } = setup();
        model.magnifyAbout(100, model.centreRe, model.centreIm);
        picture.update(SETTLE_MS + 16);
        model.zooming = 'out';

        for (let frame = 0; frame < 5; frame++) {
            model.update(16);
            picture.update(16);
            expect(picture.image.setting.width).toBe(model.width);
        }
    });

    it('takes the picture again as soon as a fast slide uncovers too much of the view', () => {
        const { model, picture } = setup();
        const takenAt = picture.image.setting.centreRe;
        model.moveCentre(HOME_SPAN * MAX_SLIDE_SHARE * 2, 0);
        model.travelRe = 1;
        picture.update(16);

        expect(picture.image.setting.centreRe).toBeGreaterThan(takenAt);
    });

    it('lets a slow slide run until the picture is due, so that it can sharpen meanwhile', () => {
        const { model, picture } = setup();
        const takenAt = picture.image.setting.centreRe;
        model.moveCentre(HOME_SPAN * MAX_SLIDE_SHARE / 2, 0);
        model.travelRe = 1;
        picture.update(16);

        expect(picture.image.setting.centreRe).toBe(takenAt);
    });

    it('fills the whole view on the first frame of a new picture', () => {
        const { model, picture } = setup();
        model.magnifyAbout(100, model.centreRe, model.centreIm);
        picture.update(SETTLE_MS + 16);
        model.zooming = 'out';
        model.update(16);
        picture.update(16);

        expect(picture.image.escapes.includes(UNKNOWN)).toBe(false);
    });

    it('follows a recentre on its way back, without waiting for it to end', () => {
        const { model, picture } = setup();
        model.magnifyAbout(1000, model.centreRe, model.centreIm);
        picture.update(SETTLE_MS + 16);
        picture.update(16);
        const takenAt = picture.image.setting.width;
        model.recentre();

        const stepMs = 16;
        for (let elapsedMs = 0; elapsedMs < MIN_RECENTRE_MS - stepMs * 2; elapsedMs += stepMs) {
            model.update(stepMs);
            picture.update(stepMs);
        }

        expect(model.isMoving).toBe(true);
        expect(picture.image.setting.width).toBeGreaterThan(takenAt);
    });

    it('stays held by a gesture, however long the scope moves', async () => {
        const { model, picture } = setup();
        await advanceTime(500, picture);
        picture.hold();
        model.travelRe = 1;
        await advanceTime(MAX_STALE_MS * 4, model, picture);

        expect(picture.image.setting.centreRe).toBe(REST_SETTINGS['mandelbrot'].centreRe);
    });
});
