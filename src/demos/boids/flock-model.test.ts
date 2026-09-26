import { describe, expect, it } from 'vitest';
import { createFlockModel } from './flock-model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultOptions() {
    return {
        arenaWidth: 100,
        arenaHeight: 60,
        boidCount: 20,
        separation: 1.5,
        alignment: 1.0,
        cohesion: 1.0,
        wander: 0,
        visionAngle: Math.PI * 2,
        maxSpeed: 20,
        minSpeed: 0,
        perceptionRadius: 10,
        seed: 1,
    };
}

function stepMs(model: { update(deltaMs: number): void }, totalMs: number): void {
    const step = 16;
    let remaining = totalMs;
    while (remaining > 0) {
        const dt = Math.min(step, remaining);
        model.update(dt);
        remaining -= dt;
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FlockModel', () => {
    it('initialises with the requested number of boids', () => {
        const model = createFlockModel(defaultOptions());
        expect(model.boidCount).toBe(20);
        expect(model.boids.length).toBe(20);
    });

    it('initialises boids within arena bounds', () => {
        const model = createFlockModel(defaultOptions());
        for (let i = 0; i < model.boids.length; i++) {
            const b = model.boids[i];
            expect(b.position.x).toBeGreaterThanOrEqual(0);
            expect(b.position.x).toBeLessThanOrEqual(100);
            expect(b.position.y).toBeGreaterThanOrEqual(0);
            expect(b.position.y).toBeLessThanOrEqual(60);
        }
    });

    it('update() moves boids', () => {
        const model = createFlockModel(defaultOptions());
        const startPositions: { x: number; y: number }[] = [];
        for (let i = 0; i < model.boids.length; i++) {
            startPositions.push({ x: model.boids[i].position.x, y: model.boids[i].position.y });
        }

        stepMs(model, 500);

        let anyMoved = false;
        for (let i = 0; i < model.boids.length; i++) {
            if (model.boids[i].position.x !== startPositions[i].x || model.boids[i].position.y !== startPositions[i].y) {
                anyMoved = true;
                break;
            }
        }
        expect(anyMoved).toBe(true);
    });

    it('keeps boids within arena bounds via edge repulsion', () => {
        const model = createFlockModel(defaultOptions());

        stepMs(model, 5000);

        for (let i = 0; i < model.boids.length; i++) {
            const b = model.boids[i];
            expect(b.position.x).toBeGreaterThanOrEqual(0);
            expect(b.position.x).toBeLessThanOrEqual(100);
            expect(b.position.y).toBeGreaterThanOrEqual(0);
            expect(b.position.y).toBeLessThanOrEqual(60);
        }
    });

    it('populates debug force vectors', () => {
        const model = createFlockModel({
            ...defaultOptions(),
            boidCount: 50,
            perceptionRadius: 30,
        });

        stepMs(model, 200);

        let anyNonZero = false;
        for (let i = 0; i < model.boids.length; i++) {
            const b = model.boids[i];
            if (b.separationDx !== 0 || b.separationDy !== 0
                || b.alignmentDx !== 0 || b.alignmentDy !== 0
                || b.cohesionDx !== 0 || b.cohesionDy !== 0) {
                anyNonZero = true;
                break;
            }
        }
        expect(anyNonZero).toBe(true);
    });

    it('setBoidCount adds boids', () => {
        const model = createFlockModel(defaultOptions());
        model.boidCount = 30;
        expect(model.boidCount).toBe(30);
        expect(model.boids.length).toBe(30);
    });

    it('setBoidCount removes boids', () => {
        const model = createFlockModel(defaultOptions());
        model.boidCount = 5;
        expect(model.boidCount).toBe(5);
        expect(model.boids.length).toBe(5);
    });

    it('perceptionRadius setter changes the perception radius', () => {
        const model = createFlockModel(defaultOptions());
        model.perceptionRadius = 25;
        expect(model.perceptionRadius).toBe(25);
    });

    describe('weight controls', () => {
        it('setting all weights to 0 means flocking forces do not steer boids', () => {
            // All flocking weights are zero. Edge repulsion may still apply,
            // so we use a very short step (0.1 ms) and relaxed precision.
            const model = createFlockModel({
                ...defaultOptions(),
                separation: 0,
                alignment: 0,
                cohesion: 0,
                wander: 0,
            });

            // Record initial velocities. Compare components rather than
            // direction, which wraps at +/-PI and made this test flaky.
            const initialVx: number[] = [];
            const initialVy: number[] = [];
            for (let i = 0; i < model.boids.length; i++) {
                initialVx.push(model.boids[i].vx);
                initialVy.push(model.boids[i].vy);
            }

            // Very short step to minimise edge-force drift
            model.update(0.1);

            // Velocity should be approximately unchanged
            for (let i = 0; i < model.boids.length; i++) {
                expect(model.boids[i].vx).toBeCloseTo(initialVx[i], 2);
                expect(model.boids[i].vy).toBeCloseTo(initialVy[i], 2);
            }
        });

        it('separation setter updates the weight', () => {
            const model = createFlockModel(defaultOptions());
            model.separation = 5;
            expect(model.separation).toBe(5);
        });

        it('alignment setter updates the weight', () => {
            const model = createFlockModel(defaultOptions());
            model.alignment = 3;
            expect(model.alignment).toBe(3);
        });

        it('cohesion setter updates the weight', () => {
            const model = createFlockModel(defaultOptions());
            model.cohesion = 2;
            expect(model.cohesion).toBe(2);
        });
    });

    it('is reproducible from a seed', () => {
        const a = createFlockModel({ ...defaultOptions(), wander: 5 });
        const b = createFlockModel({ ...defaultOptions(), wander: 5 });
        stepMs(a, 1000);
        stepMs(b, 1000);
        for (let i = 0; i < a.boids.length; i++) {
            expect(b.boids[i].position).toEqual(a.boids[i].position);
        }
    });

    it('separation pushes a boid directly away from a close neighbour', () => {
        // Asserts the force itself rather than where the flock ends up. The
        // flock is chaotic, so "boids end up further apart" only holds on
        // average and made this test flaky. A boid with exactly one neighbour
        // inside separation range must be pushed straight away from it, at a
        // magnitude equal to the separation weight.
        const separation = 5;
        const model = createFlockModel({
            ...defaultOptions(),
            boidCount: 60,
            separation,
            alignment: 0,
            cohesion: 0,
        });

        // Forces are computed from positions at the start of the update
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < model.boids.length; i++) {
            xs.push(model.boids[i].position.x);
            ys.push(model.boids[i].position.y);
        }
        model.update(16);

        const separationRadius = model.perceptionRadius * 0.4;
        let checked = 0;
        for (let i = 0; i < xs.length; i++) {
            let neighbour = -1;
            let neighbourCount = 0;
            for (let j = 0; j < xs.length; j++) {
                if (i !== j && Math.hypot(xs[j] - xs[i], ys[j] - ys[i]) < separationRadius) {
                    neighbour = j;
                    neighbourCount++;
                }
            }
            if (neighbourCount !== 1) continue;

            const dist = Math.hypot(xs[neighbour] - xs[i], ys[neighbour] - ys[i]);
            const boid = model.boids[i];
            expect(boid.separationDx).toBeCloseTo(-(xs[neighbour] - xs[i]) / dist * separation);
            expect(boid.separationDy).toBeCloseTo(-(ys[neighbour] - ys[i]) / dist * separation);
            checked++;
        }
        // The seeded flock is crowded enough that some boids qualify
        expect(checked).toBeGreaterThan(0);
    });

    it('cohesion pulls each boid toward the centre of its neighbours', () => {
        // Asserts the force itself, for the same reason as the separation
        // test: where a chaotic flock ends up only holds on average. With a
        // perception radius spanning the arena, every boid sees every other,
        // so its cohesion force points at the centroid of the rest.
        const cohesion = 3;
        const model = createFlockModel({
            ...defaultOptions(),
            boidCount: 20,
            separation: 0,
            alignment: 0,
            cohesion,
            perceptionRadius: 200,
        });

        // Forces are computed from positions at the start of the update
        const xs: number[] = [];
        const ys: number[] = [];
        let sumX = 0;
        let sumY = 0;
        for (let i = 0; i < model.boids.length; i++) {
            xs.push(model.boids[i].position.x);
            ys.push(model.boids[i].position.y);
            sumX += xs[i];
            sumY += ys[i];
        }
        model.update(16);

        const others = xs.length - 1;
        for (let i = 0; i < xs.length; i++) {
            const centroidX = (sumX - xs[i]) / others;
            const centroidY = (sumY - ys[i]) / others;
            expect(model.boids[i].cohesionDx).toBeCloseTo((centroidX - xs[i]) * cohesion);
            expect(model.boids[i].cohesionDy).toBeCloseTo((centroidY - ys[i]) * cohesion);
        }
    });

    it('handles zero boids without errors', () => {
        const model = createFlockModel({ ...defaultOptions(), boidCount: 0 });
        expect(() => stepMs(model, 100)).not.toThrow();
    });

    it('enforces minSpeed so boids never slow below the threshold', () => {
        const model = createFlockModel({
            ...defaultOptions(),
            boidCount: 50,
            separation: 0,
            alignment: 5,
            cohesion: 5,
            minSpeed: 5,
        });

        // Run long enough for alignment to dampen velocities
        stepMs(model, 10000);

        for (let i = 0; i < model.boids.length; i++) {
            const b = model.boids[i];
            expect(b.speed).toBeGreaterThanOrEqual(5 - 0.001);
        }
    });

    it('wander force prevents velocity convergence', () => {
        // With alignment only, boids converge to uniform velocity.
        // With wander added, direction variance should remain higher.
        const model = createFlockModel({
            ...defaultOptions(),
            boidCount: 30,
            separation: 0,
            alignment: 2,
            cohesion: 0,
            wander: 5,
            perceptionRadius: 100,
        });

        stepMs(model, 5000);

        // Measure direction spread - should not be near-zero
        let sinSum = 0;
        let cosSum = 0;
        for (let i = 0; i < model.boids.length; i++) {
            sinSum += Math.sin(model.boids[i].direction);
            cosSum += Math.cos(model.boids[i].direction);
        }
        // Mean resultant length: 1 = all same direction, 0 = uniform spread
        const mrl = Math.sqrt(sinSum * sinSum + cosSum * cosSum) / model.boids.length;
        expect(mrl).toBeLessThan(0.95);
    });

    it('wander setter updates the weight', () => {
        const model = createFlockModel(defaultOptions());
        model.wander = 7;
        expect(model.wander).toBe(7);
    });

    it('visionAngle setter updates the angle', () => {
        const model = createFlockModel(defaultOptions());
        model.visionAngle = Math.PI;
        expect(model.visionAngle).toBe(Math.PI);
    });

    it('narrow vision cone reduces effective neighbour count', () => {
        // With full vision, all neighbours are seen. With a narrow forward cone,
        // boids behind are excluded, reducing cohesion (spread stays larger).
        const wideModel = createFlockModel({
            ...defaultOptions(),
            boidCount: 30,
            separation: 0,
            alignment: 0,
            cohesion: 3,
            visionAngle: Math.PI * 2,
            perceptionRadius: 100,
        });
        const narrowModel = createFlockModel({
            ...defaultOptions(),
            boidCount: 30,
            separation: 0,
            alignment: 0,
            cohesion: 3,
            visionAngle: Math.PI / 2,
            perceptionRadius: 100,
        });

        stepMs(wideModel, 3000);
        stepMs(narrowModel, 3000);

        const wideSpread = computeSpread(wideModel);
        const narrowSpread = computeSpread(narrowModel);
        // Narrow vision should lead to less cohesion (larger spread)
        expect(narrowSpread).toBeGreaterThan(wideSpread);
    });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function computeSpread(model: { boids: readonly { position: { x: number; y: number } }[] }): number {
    const count = model.boids.length;
    if (count === 0) return 0;

    let avgX = 0;
    let avgY = 0;
    for (let i = 0; i < count; i++) {
        avgX += model.boids[i].position.x;
        avgY += model.boids[i].position.y;
    }
    avgX /= count;
    avgY /= count;

    let variance = 0;
    for (let i = 0; i < count; i++) {
        const dx = model.boids[i].position.x - avgX;
        const dy = model.boids[i].position.y - avgY;
        variance += dx * dx + dy * dy;
    }
    return variance / count;
}
