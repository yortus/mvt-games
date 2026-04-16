import { Container, Graphics } from 'pixi.js';
import { createSequenceReaction, type Sequence } from '#common';
import type { CactusCell } from '../../models';
import { CELL_WIDTH_PX, CELL_HEIGHT_PX } from '../view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FireworkViewBindings {
    getMatchedCells(): readonly Readonly<CactusCell>[];
    getMatchSequence(): Sequence<'fireworkLaunch' | 'fireworkBurst'>;
    getCascadeStep(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFireworkView(bindings: FireworkViewBindings): Container {
    const view = new Container();

    // Pre-allocate firework particle graphics
    const gfxPool: Graphics[] = [];
    const launchX = new Float64Array(FIREWORK_POOL_SIZE);
    const launchY = new Float64Array(FIREWORK_POOL_SIZE);
    const peakX = new Float64Array(FIREWORK_POOL_SIZE);
    const peakY = new Float64Array(FIREWORK_POOL_SIZE);
    const burstOriginX = new Float64Array(FIREWORK_POOL_SIZE);
    const burstOriginY = new Float64Array(FIREWORK_POOL_SIZE);
    const burstDx = new Float64Array(FIREWORK_POOL_SIZE);
    const burstDy = new Float64Array(FIREWORK_POOL_SIZE);

    for (let i = 0; i < FIREWORK_POOL_SIZE; i++) {
        const g = new Graphics();
        g.circle(0, 0, PARTICLE_RADIUS).fill(FIREWORK_COLOURS[i % FIREWORK_COLOURS.length]);
        g.alpha = 0;
        view.addChild(g);
        gfxPool.push(g);
    }

    // Mutable centre for launch origin, set in entering callback
    let centreX = 0;
    let centreY = 0;

    const updateFirework = createSequenceReaction(bindings.getMatchSequence(), {
        fireworkLaunch: {
            entering: () => {
                const cascade = bindings.getCascadeStep();
                if (cascade < MIN_CASCADE_FOR_FIREWORKS) return;

                const centre = computeMatchCentre(bindings.getMatchedCells());
                centreX = centre.x;
                centreY = centre.y;

                // Assign launch positions and burst vectors per particle
                for (let i = 0; i < FIREWORK_POOL_SIZE; i++) {
                    const cluster = Math.floor(i / PARTICLES_PER_CLUSTER);
                    const spread = (cluster - CLUSTER_COUNT * 0.5 + 0.5) * CLUSTER_SPREAD;
                    launchX[i] = centreX + spread;
                    launchY[i] = centreY;
                    peakX[i] = centreX + spread * 0.5;
                    peakY[i] = centreY - LAUNCH_HEIGHT - cluster * 30;

                    const angleIdx = i % PARTICLES_PER_CLUSTER;
                    const angle = (angleIdx / PARTICLES_PER_CLUSTER) * Math.PI * 2;
                    burstDx[i] = Math.cos(angle) * BURST_RADIUS;
                    burstDy[i] = Math.sin(angle) * BURST_RADIUS;
                }
            },
            active: (progress) => {
                const cascade = bindings.getCascadeStep();
                if (cascade < MIN_CASCADE_FOR_FIREWORKS) return;

                const count = particleCount(cascade);
                for (let i = 0; i < count; i++) {
                    const g = gfxPool[i];
                    g.position.set(
                        launchX[i] + (peakX[i] - launchX[i]) * progress,
                        launchY[i] + (peakY[i] - launchY[i]) * progress,
                    );
                    g.alpha = 0.7 + 0.3 * progress;
                    g.scale.set(0.8 + 0.7 * progress);
                }
                for (let i = count; i < FIREWORK_POOL_SIZE; i++) {
                    gfxPool[i].alpha = 0;
                }
            },
        },
        fireworkBurst: {
            inactive: () => {
                for (let i = 0; i < FIREWORK_POOL_SIZE; i++) {
                    gfxPool[i].alpha = 0;
                }
            },
            entering: () => {
                // Capture where each particle currently is so the burst
                // radiates from the actual launch endpoint, not the
                // theoretical peak (which launch may not have reached).
                for (let i = 0; i < FIREWORK_POOL_SIZE; i++) {
                    burstOriginX[i] = gfxPool[i].position.x;
                    burstOriginY[i] = gfxPool[i].position.y;
                }
            },
            active: (progress) => {
                const cascade = bindings.getCascadeStep();
                if (cascade < MIN_CASCADE_FOR_FIREWORKS) return;

                const count = particleCount(cascade);
                const fade = 1 - progress;
                for (let i = 0; i < count; i++) {
                    const g = gfxPool[i];
                    g.position.set(
                        burstOriginX[i] + burstDx[i] * progress,
                        burstOriginY[i] + burstDy[i] * progress + BURST_GRAVITY * progress * progress,
                    );
                    g.alpha = fade;
                    g.scale.set(1.2 - progress * 0.7);
                }
                for (let i = count; i < FIREWORK_POOL_SIZE; i++) {
                    gfxPool[i].alpha = 0;
                }
            },
        },
    });

    view.onRender = updateFirework;
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Minimum cascade step before fireworks activate. */
const MIN_CASCADE_FOR_FIREWORKS = 3;

/** Number of firework clusters. */
const CLUSTER_COUNT = 5;
/** Particles per cluster. */
const PARTICLES_PER_CLUSTER = 8;
/** Total pre-allocated particles. */
const FIREWORK_POOL_SIZE = CLUSTER_COUNT * PARTICLES_PER_CLUSTER;
/** Horizontal spread between cluster centres in pixels. */
const CLUSTER_SPREAD = 120;

/** Particle circle radius in pixels. */
const PARTICLE_RADIUS = 12;
/** How far particles rise during launch in pixels. */
const LAUNCH_HEIGHT = 500;
/** How far particles spread during burst in pixels. */
const BURST_RADIUS = 250;
/** Downward pull during burst to simulate gravity. */
const BURST_GRAVITY = 100;

const FIREWORK_COLOURS = [
    0xFFFF44, 0xFFCC00, 0xFFAA00, 0xFF8800, 0xFF4400,
];

function particleCount(cascade: number): number {
    return Math.min(FIREWORK_POOL_SIZE, (cascade - MIN_CASCADE_FOR_FIREWORKS + 1) * PARTICLES_PER_CLUSTER);
}

function computeMatchCentre(matchedCells: readonly Readonly<CactusCell>[]): { x: number; y: number } {
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < matchedCells.length; i++) {
        sumX += gridX(matchedCells[i].col);
        sumY += gridY(matchedCells[i].row);
    }
    return { x: sumX / matchedCells.length, y: sumY / matchedCells.length };
}

function gridX(col: number): number {
    return col * CELL_WIDTH_PX + CELL_WIDTH_PX * 0.5;
}

function gridY(row: number): number {
    return row * CELL_HEIGHT_PX + CELL_HEIGHT_PX * 0.5;
}
