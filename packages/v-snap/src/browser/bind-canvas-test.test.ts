import { Graphics } from 'pixi.js';
import { Group, PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import type { threeViews } from '../three';
import type { CanvasTestOptions, VsnapConfig } from './view-kinds';
import type { CanvasTestAPI } from './visual-test';

// This package's own vsnap.config.ts registers Pixi, three.js and sketch
// views, with Pixi as the default. A canvasTest bound to another config, of
// three.js views only, knows that config's kinds instead.
type ThreeOnly = VsnapConfig<readonly [ReturnType<typeof threeViews>], 'three'>;

describe('bindCanvasTest', () => {
    it("types canvasTest by the bound config's kinds, not the registered config's", () => {
        // Declarations for the type checker only: this function is never called.
        const declareTests = (canvasTest: CanvasTestAPI, bound: CanvasTestAPI<ThreeOnly>): void => {
            canvasTest('the registered default kind', () => new Graphics());
            canvasTest('a registered kind', { kind: 'sketch' }, () => ({ paint: () => {} }));

            bound('the bound default kind', { width: 80, height: 60, camera: () => new PerspectiveCamera() }, () => new Group());
            // @ts-expect-error: three.js views need a size and a camera, so the default kind can't leave out its options.
            bound('no options', () => new Group());
            // @ts-expect-error: the bound config has no sketch views.
            bound('a kind of the registered config only', { kind: 'sketch' }, () => ({ paint: () => {} }));
            // @ts-expect-error: the bound default kind is three.js, so a Pixi view is the wrong kind.
            bound.each([1, 2])('case %s', { width: 80, height: 60, camera: () => new PerspectiveCamera() }, () => new Graphics());
        };
        expect(declareTests).toBeTypeOf('function');
    });

    it("names a bound config's options with CanvasTestOptions", () => {
        const options: CanvasTestOptions<'three', ThreeOnly> = { kind: 'three', width: 80, height: 60, camera: () => new PerspectiveCamera() };
        // For the type checker only: the bound config has no sketch views.
        // @ts-expect-error: 'sketch' is not a kind of the bound config.
        const isSketch = (sketch: CanvasTestOptions<'sketch', ThreeOnly>): boolean => sketch !== undefined;
        expect(options.kind).toBe('three');
        expect(isSketch).toBeTypeOf('function');
    });
});
