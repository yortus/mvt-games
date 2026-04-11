import { type DeepReadonly } from '#common';
import { type BoidModel, createBoidModel } from './boid-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A flock of boids simulated with separation, alignment, and cohesion rules. */
export interface FlockModel {
    /** All boids currently in the flock. */
    readonly boids: DeepReadonly<BoidModel[]>;
    /** Arena width in metres. */
    readonly arenaWidth: number;
    /** Arena height in metres. */
    readonly arenaHeight: number;
    /** Separation force weight. Higher values push boids apart more aggressively. */
    separation: number;
    /** Alignment force weight. Higher values make boids match neighbours' headings. */
    alignment: number;
    /** Cohesion force weight. Higher values pull boids toward neighbours' centre. */
    cohesion: number;
    /** Wander force weight. Higher values add more random steering. */
    wander: number;
    /** Vision cone half-angle in radians. Boids ignore neighbours outside this cone. */
    visionAngle: number;
    /** Number of boids in the flock. Setting this adds or removes boids. */
    boidCount: number;
    /** Radius in metres within which a boid perceives neighbours. */
    perceptionRadius: number;
    /** Minimum scalar speed in m/s. Boids are accelerated if slower. */
    readonly minSpeed: number;
    /** Maximum scalar speed in m/s. Boids are clamped if faster. */
    readonly maxSpeed: number;
    /** Advance the simulation by the given elapsed time. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating a {@link FlockModel}. */
export interface FlockModelOptions {
    /** Arena width in metres. */
    readonly arenaWidth: number;
    /** Arena height in metres. */
    readonly arenaHeight: number;
    /** Initial number of boids. */
    readonly boidCount: number;
    /** Initial separation force weight. */
    readonly separation: number;
    /** Initial alignment force weight. */
    readonly alignment: number;
    /** Initial cohesion force weight. */
    readonly cohesion: number;
    /** Initial wander force weight. */
    readonly wander: number;
    /** Initial vision cone angle in radians. */
    readonly visionAngle: number;
    /** Minimum scalar speed in m/s. */
    readonly minSpeed: number;
    /** Maximum scalar speed in m/s. */
    readonly maxSpeed: number;
    /** Initial perception radius in metres. */
    readonly perceptionRadius: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a flock simulation model with the given initial parameters. */
export function createFlockModel(options: FlockModelOptions): FlockModel {
    const { arenaWidth, arenaHeight, maxSpeed, minSpeed } = options;

    let separation = options.separation;
    let alignment = options.alignment;
    let cohesion = options.cohesion;
    let wander = options.wander;
    let visionAngle = options.visionAngle;
    let perceptionRadius = options.perceptionRadius;

    const boids: BoidModel[] = [];
    populateBoids(boids, options.boidCount, arenaWidth, arenaHeight, maxSpeed);

    const model: FlockModel = {
        get boids() { return boids; },
        arenaWidth,
        arenaHeight,
        maxSpeed,
        minSpeed,
        get separation() { return separation; },
        set separation(value) { separation = value; },
        get alignment() { return alignment; },
        set alignment(value) { alignment = value; },
        get cohesion() { return cohesion; },
        set cohesion(value) { cohesion = value; },
        get wander() { return wander; },
        set wander(value) { wander = value; },
        get visionAngle() { return visionAngle; },
        set visionAngle(value) { visionAngle = value; },
        get boidCount() { return boids.length; },
        set boidCount(count) {
            const target = Math.max(0, Math.round(count));
            while (boids.length < target) {
                boids.push(randomBoid(arenaWidth, arenaHeight, maxSpeed));
            }
            while (boids.length > target) {
                boids.pop();
            }
        },
        get perceptionRadius() { return perceptionRadius; },
        set perceptionRadius(radius) { perceptionRadius = radius; },
        update,
    };

    return model;

    // ---- Update ------------------------------------------------------------

    function update(deltaMs: number): void {
        const dt = deltaMs / 1000;
        const count = boids.length;
        if (count === 0) return;

        applySteeringForces(dt, count);
        integratePositions(dt, count);
    }

    // ---- Update helpers ----------------------------------------------------

    function applySteeringForces(dt: number, count: number): void {
        const sepRadiusSq = (perceptionRadius * SEPARATION_FRACTION) * (perceptionRadius * SEPARATION_FRACTION);
        const percRadiusSq = perceptionRadius * perceptionRadius;
        const edgeMarginX = arenaWidth * EDGE_MARGIN_FRACTION;
        const edgeMarginY = arenaHeight * EDGE_MARGIN_FRACTION;
        const halfVision = visionAngle / 2;
        const useVisionCone = visionAngle < Math.PI * 2 - 0.01;

        for (let i = 0; i < count; i++) {
            const boid = boids[i];
            const bx = boid.position.x;
            const by = boid.position.y;
            const boidHeading = Math.atan2(boid.vy, boid.vx);

            // Wander: drift the wander angle randomly, then compute force
            boid.wanderAngle += (Math.random() - 0.5) * WANDER_JITTER * dt;
            const wanderX = Math.cos(boidHeading + boid.wanderAngle);
            const wanderY = Math.sin(boidHeading + boid.wanderAngle);

            // Accumulate neighbour forces
            let sepX = 0;
            let sepY = 0;
            let aliVx = 0;
            let aliVy = 0;
            let cohX = 0;
            let cohY = 0;
            let sepCount = 0;
            let neighbourCount = 0;

            for (let j = 0; j < count; j++) {
                if (i === j) continue;
                const other = boids[j];

                const dx = other.position.x - bx;
                const dy = other.position.y - by;
                const distSq = dx * dx + dy * dy;

                if (distSq < percRadiusSq && distSq > 0) {
                    if (useVisionCone) {
                        let angle = Math.atan2(dy, dx) - boidHeading;
                        if (angle > Math.PI) angle -= Math.PI * 2;
                        else if (angle < -Math.PI) angle += Math.PI * 2;
                        if (angle > halfVision || angle < -halfVision) continue;
                    }

                    aliVx += other.vx;
                    aliVy += other.vy;
                    cohX += other.position.x;
                    cohY += other.position.y;
                    neighbourCount++;

                    if (distSq < sepRadiusSq) {
                        const dist = Math.sqrt(distSq);
                        sepX -= dx / dist;
                        sepY -= dy / dist;
                        sepCount++;
                    }
                }
            }

            // Average and compute steering forces
            let sfx = 0;
            let sfy = 0;
            let afx = 0;
            let afy = 0;
            let cfx = 0;
            let cfy = 0;

            if (sepCount > 0) {
                sfx = sepX / sepCount;
                sfy = sepY / sepCount;
            }

            if (neighbourCount > 0) {
                afx = aliVx / neighbourCount - boid.vx;
                afy = aliVy / neighbourCount - boid.vy;
                cfx = cohX / neighbourCount - bx;
                cfy = cohY / neighbourCount - by;
            }

            // Edge repulsion: quadratic falloff over a wide margin
            let edgeX = 0;
            let edgeY = 0;
            if (bx < edgeMarginX) {
                const t = 1 - bx / edgeMarginX;
                edgeX = t * t;
            }
            else if (bx > arenaWidth - edgeMarginX) {
                const t = 1 - (arenaWidth - bx) / edgeMarginX;
                edgeX = -(t * t);
            }
            if (by < edgeMarginY) {
                const t = 1 - by / edgeMarginY;
                edgeY = t * t;
            }
            else if (by > arenaHeight - edgeMarginY) {
                const t = 1 - (arenaHeight - by) / edgeMarginY;
                edgeY = -(t * t);
            }

            // Store debug vectors (weighted acceleration contributions)
            boid.separationDx = sfx * separation;
            boid.separationDy = sfy * separation;
            boid.alignmentDx = afx * alignment;
            boid.alignmentDy = afy * alignment;
            boid.cohesionDx = cfx * cohesion;
            boid.cohesionDy = cfy * cohesion;

            // Apply weighted forces to velocity
            boid.vx += (sfx * separation + afx * alignment + cfx * cohesion + wanderX * wander + edgeX * EDGE_FORCE) * dt;
            boid.vy += (sfy * separation + afy * alignment + cfy * cohesion + wanderY * wander + edgeY * EDGE_FORCE) * dt;

            // Clamp speed
            clampSpeed(boid);
        }
    }

    function clampSpeed(boid: BoidModel): void {
        const speedSq = boid.vx * boid.vx + boid.vy * boid.vy;
        if (speedSq > maxSpeed * maxSpeed) {
            const speed = Math.sqrt(speedSq);
            boid.vx = (boid.vx / speed) * maxSpeed;
            boid.vy = (boid.vy / speed) * maxSpeed;
        }
        else if (minSpeed > 0 && speedSq > 0 && speedSq < minSpeed * minSpeed) {
            const speed = Math.sqrt(speedSq);
            boid.vx = (boid.vx / speed) * minSpeed;
            boid.vy = (boid.vy / speed) * minSpeed;
        }
    }

    function integratePositions(dt: number, count: number): void {
        for (let i = 0; i < count; i++) {
            const boid = boids[i];
            const pos = boid.position;

            pos.x += boid.vx * dt;
            pos.y += boid.vy * dt;

            // Hard clamp so nothing escapes
            if (pos.x < 0) pos.x = 0;
            else if (pos.x > arenaWidth) pos.x = arenaWidth;
            if (pos.y < 0) pos.y = 0;
            else if (pos.y > arenaHeight) pos.y = arenaHeight;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Separation radius as a fraction of perception radius. */
const SEPARATION_FRACTION = 0.4;

/** Strength of the repulsive force applied near arena edges. */
const EDGE_FORCE = 40;

/** Edge margin as a fraction of each arena dimension (0.25 = outer 25%). */
const EDGE_MARGIN_FRACTION = 0.25;

/** Rate at which the wander angle drifts (radians/second scaling factor). */
const WANDER_JITTER = 8;

function randomBoid(arenaWidth: number, arenaHeight: number, maxSpeed: number): BoidModel {
    const angle = Math.random() * Math.PI * 2;
    const speed = maxSpeed * (0.3 + Math.random() * 0.7);
    return createBoidModel({
        position: { x: Math.random() * arenaWidth, y: Math.random() * arenaHeight },
        speed,
        direction: angle,
    });
}

function populateBoids(
    boids: BoidModel[],
    count: number,
    arenaWidth: number,
    arenaHeight: number,
    maxSpeed: number,
): void {
    for (let i = 0; i < count; i++) {
        boids.push(randomBoid(arenaWidth, arenaHeight, maxSpeed));
    }
}
