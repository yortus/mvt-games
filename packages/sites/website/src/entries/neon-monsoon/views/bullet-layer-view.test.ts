import { type ParticleContainer, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/pixi';
import { BulletLayerView } from './bullet-layer-view';

type TestKind = 'round' | 'long';

/** A stand-in for a bullet field: plain arrays the test edits between frames. */
function setUp() {
    const bullets = { xs: [] as number[], ys: [] as number[], kinds: [] as TestKind[], angles: [] as number[], ages: [] as number[] };
    const textures = { round: Texture.WHITE, long: Texture.EMPTY };
    const view = BulletLayerView<TestKind>({
        capacity: 8,
        textures,
        width: 240,
        height: 320,
        count: () => bullets.xs.length,
        xAt: (i) => bullets.xs[i],
        yAt: (i) => bullets.ys[i],
        kindAt: (i) => bullets.kinds[i],
        angleAt: (i) => bullets.angles[i],
        ageAt: (i) => bullets.ages[i],
    }) as ParticleContainer;
    const add = (x: number, y: number, kind: TestKind, angle = 0, age = 1000): void => {
        bullets.xs.push(x);
        bullets.ys.push(y);
        bullets.kinds.push(kind);
        bullets.angles.push(angle);
        bullets.ages.push(age);
    };
    return { bullets, textures, view, add };
}

describe('BulletLayerView', () => {
    it('shows one particle per bullet, with the bullet\'s position, angle and texture', () => {
        const { textures, view, add } = setUp();
        add(10, 20, 'round');
        add(30, 40, 'long', 1.5);
        refreshView(view);

        const particles = view.particleChildren;
        expect(particles.length).toBe(2);
        expect([particles[0].x, particles[0].y]).toEqual([10, 20]);
        expect(particles[0].texture).toBe(textures.round);
        expect(particles[1].rotation).toBe(1.5);
        expect(particles[1].texture).toBe(textures.long);
    });

    it('follows the count down and up, reusing the same particles', () => {
        const { bullets, view, add } = setUp();
        add(1, 1, 'round');
        add(2, 2, 'round');
        add(3, 3, 'round');
        refreshView(view);
        const second = view.particleChildren[1];

        bullets.xs.length = 1;
        refreshView(view);
        expect(view.particleChildren.length).toBe(1);

        add(5, 5, 'long');
        refreshView(view);
        expect(view.particleChildren.length).toBe(2);
        expect(view.particleChildren[1]).toBe(second);
        expect(view.particleChildren[1].x).toBe(5);
    });

    it('re-reads every field when a different bullet moves into an index', () => {
        const { bullets, textures, view, add } = setUp();
        add(1, 1, 'round');
        add(2, 2, 'long');
        refreshView(view);

        // The model removes bullet 0 by moving the last bullet into its place.
        bullets.xs.splice(0, 1);
        bullets.ys.splice(0, 1);
        bullets.kinds.splice(0, 1);
        bullets.angles.splice(0, 1);
        bullets.ages.splice(0, 1);
        refreshView(view);
        expect(view.particleChildren[0].x).toBe(2);
        expect(view.particleChildren[0].texture).toBe(textures.long);
    });

    it('draws a new bullet larger, shrinking to its size', () => {
        const { bullets, view, add } = setUp();
        add(1, 1, 'round', 0, 0);
        refreshView(view);
        expect(view.particleChildren[0].scaleX).toBeGreaterThan(1);

        bullets.ages[0] = 500;
        refreshView(view);
        expect(view.particleChildren[0].scaleX).toBe(1);
    });
});
