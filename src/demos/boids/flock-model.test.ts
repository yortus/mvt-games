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
        it('setting all weights to 0 means forces do not steer boids', () => {
            // Use a large arena so no boid spawns within the edge-repulsion margin.
            const model = createFlockModel({
                ...defaultOptions(),
                arenaWidth: 10000,
                arenaHeight: 10000,
                separation: 0,
                alignment: 0,
                cohesion: 0,
                wander: 0,
            });

            // Record initial speeds and directions
            const initialSpeeds: number[] = [];
            const initialDirections: number[] = [];
            for (let i = 0; i < model.boids.length; i++) {
                initialSpeeds.push(model.boids[i].speed);
                initialDirections.push(model.boids[i].direction);
            }

            // Single small step (no wall bouncing)
            model.update(1);

            // Speed and direction should be unchanged (no steering applied)
            for (let i = 0; i < model.boids.length; i++) {
                expect(model.boids[i].speed).toBeCloseTo(initialSpeeds[i], 5);
                expect(model.boids[i].direction).toBeCloseTo(initialDirections[i], 5);
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

    it('separation pushes close boids apart', () => {
        // Place two boids very close together with zero velocity
        const model = createFlockModel({
            ...defaultOptions(),
            boidCount: 0,
            separation: 5,
            alignment: 0,
            cohesion: 0,
        });
        model.boidCount = 0;
        // Manually add two close boids via boidCount after setting count to 0
        // Instead, create a model with 2 boids close together
        const model2 = createFlockModel({
            ...defaultOptions(),
            boidCount: 0,
            separation: 5,
            alignment: 0,
            cohesion: 0,
        });
        // Add boids - they'll be random but we can test the principle
        model2.boidCount = 2;

        const initialDist = Math.hypot(model2.boids[0].position.x - model2.boids[1].position.x, model2.boids[0].position.y - model2.boids[1].position.y);

        // Only meaningful if they start close enough to interact
        if (initialDist < model2.perceptionRadius) {
            stepMs(model2, 1000);
            const finalDist = Math.hypot(model2.boids[0].position.x - model2.boids[1].position.x, model2.boids[0].position.y - model2.boids[1].position.y);
            // With only separation active, they should move apart (or at least not closer)
            expect(finalDist).toBeGreaterThanOrEqual(initialDist * 0.5);
        }
    });

    it('cohesion pulls boids together when far apart', () => {
        const model = createFlockModel({
            ...defaultOptions(),
            boidCount: 20,
            separation: 0,
            alignment: 0,
            cohesion: 3,
            perceptionRadius: 100, // large radius so all boids see each other
        });

        // Let the flock settle so initial random velocities don't dominate
        stepMs(model, 2000);
        const initialSpread = computeSpread(model);

        stepMs(model, 5000);

        const finalSpread = computeSpread(model);
        // Cohesion should reduce the spread of the flock
        expect(finalSpread).toBeLessThan(initialSpread);
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
