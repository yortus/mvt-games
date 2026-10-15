import { Group, PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import type { CanvasTestAPI, VsnapConfig } from '../browser';
import { threeViews } from './three-views';

const camera = (): PerspectiveCamera => new PerspectiveCamera();

// A project whose three.js views share a screen size and camera gives them
// to threeViews() once, and its tests leave them out.
type Screen = VsnapConfig<readonly [ReturnType<typeof threeViews<{ width: number; height: number; camera: typeof camera }>>], 'three'>;
type Plain = VsnapConfig<readonly [ReturnType<typeof threeViews>], 'three'>;
type SizeOnly = VsnapConfig<readonly [ReturnType<typeof threeViews<{ width: number; height: number }>>], 'three'>;

describe('threeViews({ width, height, camera })', () => {
    it('lets a test leave out the options that threeViews() gave', () => {
        // Declarations for the type checker only: this function is never called.
        const declareTests = (screen: CanvasTestAPI<Screen>, plain: CanvasTestAPI<Plain>, sizeOnly: CanvasTestAPI<SizeOnly>): void => {
            screen('the screen', {}, () => new Group());
            screen('a close-up', { width: 80, height: 60 }, () => new Group());
            sizeOnly('with a camera', { camera }, () => new Group());
            // @ts-expect-error: threeViews() gave a size, but no camera.
            sizeOnly('without a camera', {}, () => new Group());
            // @ts-expect-error: threeViews() gave nothing, so a test needs a size and a camera.
            plain('no size', { camera }, () => new Group());
        };
        expect(declareTests).toBeTypeOf('function');
    });

    it("makes them the defaults of a test whose options don't give them", () => {
        const kind = threeViews({ width: 320, height: 240, camera, background: 0x101010 });
        expect(kind.defaults).toEqual({ width: 320, height: 240, camera, background: 0x101010, scene: undefined });
    });

    it('names what a test lacks, before it draws', () => {
        // As a test from plain JavaScript would reach it, with the kind's width
        // under its options, which the types would have rejected.
        const kind = threeViews({ width: 320 });
        expect(() => kind.draw(new Group(), { width: 320, maxPixels: 1000 } as never)).toThrow(
            "A three.js test needs its image's width, height and camera, which its options give, or threeViews() gives for every test. This one has no height or camera.",
        );
    });
});
