import { Container3D, CubeGeometry, FlatMaterial, Material3D, Mesh3D, SphereGeometry } from '@pixi/3d';
import { ownResources, setRefresh, setUpdate } from '@mvtjs/pixi-3d';
import { EXPLOSION_MS } from '../data';
import type { Explosion } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ExplosionViewBindings {
    /** The model's pool of explosions, read once. Its slots change as explosions go off and die away. */
    readonly explosions: readonly Explosion[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A fireball, a burst of debris, and rising smoke, for each explosion. The
 * model says where and when each explosion went off. The view keeps one set
 * of meshes for each of the model's slots, so it doesn't make or drop meshes
 * as explosions come and go. The fireball and the smoke follow the
 * explosion's age. The debris is presentation state, which the model doesn't
 * track, so the view flings it as an explosion starts and moves it on in its
 * update step.
 */
export function ExplosionView(bindings: ExplosionViewBindings): Container3D {
    const { explosions } = bindings;
    const parts = createParts();
    const view = ownResources(new Container3D({ label: 'explosions' }), Object.values(parts));
    const blasts: Blast[] = [];
    for (let i = 0; i < explosions.length; i++) {
        const blast = createBlast(parts, i);
        blasts.push(blast);
        view.addChild(blast.group);
    }

    setUpdate(view, (deltaMs) => {
        for (let i = 0; i < blasts.length; i++) {
            const explosion = explosions[i];
            const blast = blasts[i];
            // A new serial is a new explosion in this slot
            if (explosion.isActive && explosion.serial !== blast.serial) startBlast(blast, explosion.serial);
            if (explosion.isActive) advanceBlast(blast, deltaMs);
        }
    });
    setRefresh(view, () => {
        for (let i = 0; i < blasts.length; i++) drawBlast(blasts[i], explosions[i]);
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEBRIS_COUNT = 12;
const SMOKE_COUNT = 5;
/** How long the fireball takes to swell, then to shrink away. */
const FIREBALL_GROW_MS = 180;
const FIREBALL_MS = 650;
const FIREBALL_SIZE = 3.4;
const GRAVITY = 28;

type BlastParts = ReturnType<typeof createParts>;

/** One explosion's meshes, and where it is in its life. */
interface Blast {
    readonly group: Container3D;
    readonly fireball: Mesh3D;
    readonly core: Mesh3D;
    readonly smoke: readonly Mesh3D[];
    readonly debris: readonly Mesh3D[];
    /** Each piece of debris's position and velocity, three numbers each, and its spin. */
    readonly debrisPosition: Float64Array;
    readonly debrisVelocity: Float64Array;
    readonly debrisSpin: Float64Array;
    /** Each piece of debris's size along its three axes. */
    readonly debrisSize: Float64Array;
    /** Each smoke puff's drift, two numbers each. */
    readonly smokeDrift: Float64Array;
    /** A seeded random source, so each explosion's scatter is the same in every run. */
    readonly random: () => number;
    /** The serial of the model's explosion that the debris was flung for. */
    serial: number;
}

function createParts() {
    return {
        sphere: new SphereGeometry({ radius: 1, widthSegments: 16, heightSegments: 10 }),
        cube: new CubeGeometry({ width: 1, height: 1, depth: 1 }),
        fire: new FlatMaterial({ baseColor: 0xff8a1f }),
        core: new FlatMaterial({ baseColor: 0xfff0b0 }),
        smoke: new Material3D({ baseColor: 0x2e2e30, roughness: 1 }),
        metal: new Material3D({ baseColor: 0x7a7f88, roughness: 0.5, metallic: 0.5 }),
        char: new Material3D({ baseColor: 0x1a1a1a, roughness: 0.9 }),
    };
}

function createBlast(parts: BlastParts, index: number): Blast {
    const fireball = new Mesh3D({ geometry: parts.sphere, material: parts.fire });
    const core = new Mesh3D({ geometry: parts.sphere, material: parts.core });
    const smoke: Mesh3D[] = [];
    for (let i = 0; i < SMOKE_COUNT; i++) smoke.push(new Mesh3D({ geometry: parts.sphere, material: parts.smoke }));
    const debris: Mesh3D[] = [];
    for (let i = 0; i < DEBRIS_COUNT; i++) {
        debris.push(new Mesh3D({ geometry: parts.cube, material: i % 3 === 0 ? parts.char : parts.metal, castShadow: true }));
    }
    const group = new Container3D({ children: [...smoke, fireball, core, ...debris], visible: false });
    return {
        group,
        fireball,
        core,
        smoke,
        debris,
        debrisPosition: new Float64Array(DEBRIS_COUNT * 3),
        debrisVelocity: new Float64Array(DEBRIS_COUNT * 3),
        debrisSpin: new Float64Array(DEBRIS_COUNT),
        debrisSize: new Float64Array(DEBRIS_COUNT * 3),
        smokeDrift: new Float64Array(SMOKE_COUNT * 2),
        random: createSeededRandom(BLAST_SEED + index),
        serial: 0,
    };
}

/** Flings an explosion's debris up and out from its middle. */
function startBlast(blast: Blast, serial: number): void {
    const { random } = blast;
    blast.serial = serial;
    for (let i = 0; i < DEBRIS_COUNT; i++) {
        const angle = random() * Math.PI * 2;
        const out = 6 + random() * 14;
        blast.debrisPosition.set([0, 1, 0], i * 3);
        blast.debrisVelocity.set([Math.cos(angle) * out, 8 + random() * 16, Math.sin(angle) * out], i * 3);
        blast.debrisSpin[i] = (random() - 0.5) * 20;
        blast.debrisSize[i * 3] = 0.2 + random() * 0.5;
        blast.debrisSize[i * 3 + 1] = 0.1 + random() * 0.3;
        blast.debrisSize[i * 3 + 2] = 0.2 + random() * 0.6;
    }
    for (let i = 0; i < SMOKE_COUNT; i++) {
        blast.smokeDrift[i * 2] = (random() - 0.5) * 3;
        blast.smokeDrift[i * 2 + 1] = (random() - 0.5) * 3;
    }
}

/** Moves the debris on, under gravity, bouncing it off the ground. */
function advanceBlast(blast: Blast, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const p = blast.debrisPosition;
    const v = blast.debrisVelocity;
    for (let i = 0; i < DEBRIS_COUNT; i++) {
        const j = i * 3;
        v[j + 1] -= GRAVITY * dt;
        p[j] += v[j] * dt;
        p[j + 1] += v[j + 1] * dt;
        p[j + 2] += v[j + 2] * dt;
        if (p[j + 1] < 0.1) {
            // A bounce that loses most of its speed, and scrapes along the ground
            p[j + 1] = 0.1;
            v[j + 1] = Math.abs(v[j + 1]) * 0.3;
            v[j] *= 0.6;
            v[j + 2] *= 0.6;
        }
    }
}

/** Writes an explosion's meshes from where it is in its life. */
function drawBlast(blast: Blast, explosion: Explosion): void {
    // Until its debris is flung, a new explosion waits for the update step
    const isShown = explosion.isActive && explosion.serial === blast.serial;
    blast.group.visible = isShown;
    if (!isShown) return;
    const age = explosion.ageMs;
    blast.group.x = explosion.x;
    blast.group.z = explosion.z;

    // The fireball swells fast, then shrinks away, with a hotter core inside it
    const fire = age < FIREBALL_GROW_MS
        ? Math.sin((age / FIREBALL_GROW_MS) * Math.PI / 2)
        : Math.max(0, 1 - (age - FIREBALL_GROW_MS) / (FIREBALL_MS - FIREBALL_GROW_MS));
    blast.fireball.visible = fire > 0;
    blast.fireball.scale.set(fire * FIREBALL_SIZE, fire * FIREBALL_SIZE * 0.8, fire * FIREBALL_SIZE);
    blast.fireball.y = fire * 1.4;
    blast.core.visible = fire > 0.3;
    blast.core.scale.set(fire * FIREBALL_SIZE * 0.55, fire * FIREBALL_SIZE * 0.45, fire * FIREBALL_SIZE * 0.55);
    blast.core.y = fire * 1.5;

    // Smoke puffs rise and spread, and shrink away at the end
    const t = age / EXPLOSION_MS;
    const puff = Math.sin(Math.min(1, t * 1.3) * Math.PI) * 1.6;
    for (let i = 0; i < SMOKE_COUNT; i++) {
        const smoke = blast.smoke[i];
        smoke.visible = puff > 0.05;
        const lift = 1 + t * (4 + i);
        smoke.position.set(blast.smokeDrift[i * 2] * (1 + t * 3), lift, blast.smokeDrift[i * 2 + 1] * (1 + t * 3));
        const size = puff * (0.7 + (i % 3) * 0.25);
        smoke.scale.set(size, size, size);
    }

    const p = blast.debrisPosition;
    for (let i = 0; i < DEBRIS_COUNT; i++) {
        const piece = blast.debris[i];
        piece.position.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
        piece.scale.set(blast.debrisSize[i * 3], blast.debrisSize[i * 3 + 1], blast.debrisSize[i * 3 + 2]);
        piece.rotation.set(blast.debrisSpin[i] * age / 1000, blast.debrisSpin[i] * age / 1300, 0);
    }
}

const BLAST_SEED = 911;

/** A small seeded random source, from 0 to 1, the same sequence for the same seed. */
function createSeededRandom(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}
