import { Container3D, CubeGeometry, FlatMaterial, Material3D, Mesh3D, SphereGeometry } from '@pixi/3d';
import { ownResources, setRefresh } from '@mvtjs/pixi-3d';
import { WRECKAGE_MS } from '../data';
import type { Wreckage } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WreckageViewBindings {
    /** The model's pool of wrecks, read once. Its slots change as cars blow up and their wrecks burn out. */
    readonly wreckage: readonly Wreckage[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The burning wrecks. Each is a charred car body, with flames on it and a
 * column of smoke above it. The flames flicker and the smoke rises by how
 * long the wreck has left to burn, which the model counts down, so the view
 * doesn't keep a clock of its own. The fire dies down as the wreck burns out. The
 * view keeps one wreck's meshes for each of the model's slots.
 */
export function WreckageView(bindings: WreckageViewBindings): Container3D {
    const { wreckage } = bindings;
    const parts = createParts();
    const view = ownResources(new Container3D({ label: 'wreckage' }), Object.values(parts));
    const shapes: WreckShape[] = [];
    for (let i = 0; i < wreckage.length; i++) {
        const shape = createShape(parts);
        shapes.push(shape);
        view.addChild(shape.group);
    }

    setRefresh(view, () => {
        for (let i = 0; i < shapes.length; i++) drawWreck(shapes[i], wreckage[i]);
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const FLAME_COUNT = 3;
const SMOKE_COUNT = 4;
/** Where the flames sit on the body, forward and sideways from its middle. */
const FLAME_PLACES: readonly number[] = [0.9, 0.3, -0.4, -0.2, -1.2, 0.25];
/** How long the fire takes to die down at the end, in milliseconds. */
const DYING_MS = 2500;
/** How long a smoke puff takes to rise from the wreck to the top of the column, in milliseconds. */
const SMOKE_RISE_MS = 1800;
const SMOKE_HEIGHT = 7;

type WreckParts = ReturnType<typeof createParts>;

interface WreckShape {
    readonly group: Container3D;
    /** The body and the flames, turned to the wreck's heading. The smoke rises straight up, so it isn't turned. */
    readonly hull: Container3D;
    readonly flames: readonly Mesh3D[];
    readonly smoke: readonly Mesh3D[];
}

function createParts() {
    return {
        body: new CubeGeometry({ width: 3.6, height: 0.5, depth: 1.7 }),
        cabin: new CubeGeometry({ width: 1.4, height: 0.35, depth: 1.2 }),
        sphere: new SphereGeometry({ radius: 1, widthSegments: 10, heightSegments: 8 }),
        char: new Material3D({ baseColor: 0x1e1c1b, roughness: 0.95 }),
        flame: new FlatMaterial({ baseColor: 0xff7a1a }),
        smoke: new Material3D({ baseColor: 0x333336, roughness: 1 }),
    };
}

function createShape(parts: WreckParts): WreckShape {
    const body = new Mesh3D({ geometry: parts.body, material: parts.char, y: 0.4, castShadow: true });
    const cabin = new Mesh3D({ geometry: parts.cabin, material: parts.char, x: -0.4, y: 0.8, castShadow: true });
    const flames: Mesh3D[] = [];
    for (let i = 0; i < FLAME_COUNT; i++) {
        flames.push(new Mesh3D({ geometry: parts.sphere, material: parts.flame, x: FLAME_PLACES[i * 2], z: FLAME_PLACES[i * 2 + 1] }));
    }
    const hull = new Container3D({ children: [body, cabin, ...flames] });
    const smoke: Mesh3D[] = [];
    for (let i = 0; i < SMOKE_COUNT; i++) smoke.push(new Mesh3D({ geometry: parts.sphere, material: parts.smoke }));
    const group = new Container3D({ children: [hull, ...smoke], visible: false });
    return { group, hull, flames, smoke };
}

function drawWreck(shape: WreckShape, wreck: Wreckage): void {
    shape.group.visible = wreck.isActive;
    if (!wreck.isActive) return;
    shape.group.x = wreck.x;
    shape.group.z = wreck.z;
    shape.hull.rotation.y = -wreck.heading;
    const burnedMs = WRECKAGE_MS - wreck.burnMs;
    const fire = Math.min(1, wreck.burnMs / DYING_MS);
    for (let i = 0; i < shape.flames.length; i++) {
        // Each flame flickers at its own rate, so they don't pulse together
        const flicker = 0.75 + 0.25 * Math.sin(burnedMs * (0.021 + i * 0.007) + i * 2);
        const size = 0.55 * fire * flicker;
        const flame = shape.flames[i];
        flame.visible = size > 0.02;
        flame.scale.set(size, size * 1.5, size);
        flame.y = 0.7 + size;
    }
    for (let i = 0; i < shape.smoke.length; i++) {
        // The puffs rise one after another, and spread as they go
        const rise = ((burnedMs / SMOKE_RISE_MS) + i / SMOKE_COUNT) % 1;
        const size = (0.5 + rise * 1.4) * fire;
        const puff = shape.smoke[i];
        puff.visible = size > 0.05;
        puff.position.set(rise * 1.2, 1.2 + rise * SMOKE_HEIGHT, rise * 0.6);
        puff.scale.set(size, size, size);
    }
}
