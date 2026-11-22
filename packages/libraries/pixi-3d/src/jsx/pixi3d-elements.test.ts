import { type BatchedMesh3D, type Container3D, CubeGeometry, Material3D, type Light } from '@pixi/3d';
import { Texture, TextureSource } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { jsx } from './jsx-runtime';
import { pixi3dElements } from './pixi3d-elements';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// The conformance suite checks one attribute of each write kind, which
// would miss a typo in any of the others. This writes every attribute of
// every element as a fixed value, and reads back what it wrote. A new
// attribute needs a sample below, or the first test fails, so you can't
// leave one out by accident.

describe('the PixiJS 3D element table', () => {
    it('has a sample for every attribute', () => {
        const missing: string[] = [];
        forEachAttribute((tag, key) => {
            if (sampleFor(tag, key) === undefined) missing.push(`<${tag}> ${key}`);
        });

        expect(missing).toEqual([]);
    });

    it('writes each attribute of each element to the property it names', () => {
        const wrong: string[] = [];
        forEachAttribute((tag, key) => {
            const sample = sampleFor(tag, key);
            if (sample === undefined) return;
            const el = jsx(tag, { ...CREATION[tag], [key]: sample.value });
            const actual = (sample.read as (el: unknown) => unknown)(el);
            const expected = 'expected' in sample ? sample.expected : sample.value;
            if (!isEqual(actual, expected)) wrong.push(`<${tag}> ${key}: wrote ${String(expected)}, read ${String(actual)}`);
        });

        expect(wrong).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A value to write to an attribute, and how to read it back. */
interface Sample {
    readonly value: unknown;
    readonly read: (el: never) => unknown;
    /** What reads back, when it isn't `value`. */
    readonly expected?: unknown;
}

/** Writes and reads the property named for the attribute. */
function property(key: string, value: unknown): Sample {
    return { value, read: (el: Record<string, unknown>) => el[key] };
}

const geometry = new CubeGeometry();
const material = new Material3D();
const texture = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });

const SAMPLES: Readonly<Record<string, Sample>> = {
    x: property('x', 1.5),
    y: property('y', 2.5),
    z: property('z', 3.5),
    position: { value: { x: 1, y: 2, z: 3 }, read: (e: Container3D) => ({ x: e.position.x, y: e.position.y, z: e.position.z }) },
    rotationX: { value: 0.5, read: (e: Container3D) => e.rotation.x },
    rotationY: { value: 0.5, read: (e: Container3D) => e.rotation.y },
    rotationZ: { value: 0.5, read: (e: Container3D) => e.rotation.z },
    quaternion: { value: { x: 0, y: 0, z: 0.6, w: 0.8 }, read: (e: Container3D) => ({ x: e.quaternion.x, y: e.quaternion.y, z: e.quaternion.z, w: e.quaternion.w }) },
    // Facing a point straight above turns the node away from the identity
    lookAt: { value: { x: 0, y: 10, z: 0 }, read: (e: Container3D) => e.quaternion.w !== 1, expected: true },
    scale: { value: 2, read: (e: Container3D) => [e.scale.x, e.scale.y, e.scale.z], expected: [2, 2, 2] },
    scaleX: { value: 2, read: (e: Container3D) => e.scale.x },
    scaleY: { value: 2, read: (e: Container3D) => e.scale.y },
    scaleZ: { value: 2, read: (e: Container3D) => e.scale.z },
    originX: { value: 0.5, read: (e: Container3D) => e.origin.x },
    originY: { value: 0.5, read: (e: Container3D) => e.origin.y },
    originZ: { value: 0.5, read: (e: Container3D) => e.origin.z },
    label: property('label', 'probe'),
    cursor: property('cursor', 'pointer'),
    eventMode: property('eventMode', 'static'),
    hitVolume: property('hitVolume', 'box'),
    interactiveChildren: property('interactiveChildren', false),
    castShadow: property('castShadow', true),
    receiveShadow: property('receiveShadow', false),
    billboardMode: property('billboardMode', 'spherical'),
    geometry: property('geometry', geometry),
    material: property('material', material),
    // A mesh without morph targets ignores the weights, and its `weights` stays undefined
    weights: { value: new Float32Array([0.5]), read: (e: { weights: unknown }) => e.weights, expected: undefined },
    texture: property('texture', texture),
    tint: property('tint', 0xff0000),
    alpha: property('alpha', 0.5),
    alphaMode: property('alphaMode', 'mask'),
    alphaCutoff: property('alphaCutoff', 0.25),
    anchor: { value: 0.25, read: (e: { anchor: { x: number; y: number } }) => [e.anchor.x, e.anchor.y], expected: [0.25, 0.25] },
    width: property('width', 2),
    height: property('height', 3),
    pixelSize: property('pixelSize', 0.02),
    cull: property('cull', 'cpu'),
    mode: property('mode', 'orthographic'),
    fov: property('fov', 30),
    near: property('near', 0.5),
    far: property('far', 500),
    orthographicSize: property('orthographicSize', 12),
    zoom: property('zoom', 2),
    color: { value: 0xff0000, read: (e: Light) => e.color.toNumber() },
    intensity: property('intensity', 3),
    range: property('range', 7),
    radius: property('radius', 0.5),
    coneAngle: property('coneAngle', 20),
    penumbra: property('penumbra', 0.3),
    shadow: {
        value: { cascades: 2, maxDistance: 70 },
        read: (e: Light) => ({ cascades: e.shadow.cascades, maxDistance: e.shadow.maxDistance, update: e.shadow.update }),
        expected: { cascades: 2, maxDistance: 70, update: 1 },
    },
};

/** The batch's attributes that set every copy, read from its first copy. */
const BATCH_SAMPLES: Readonly<Record<string, Sample>> = {
    geometry: { value: geometry, read: (e: BatchedMesh3D) => (e.batch.items[0] as { geometry?: unknown }).geometry },
    material: { value: material, read: (e: BatchedMesh3D) => (e.batch.items[0] as { material?: unknown }).material },
};

/** The creation attributes that an element requires. */
const CREATION: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
    batchedMesh: { size: 2 },
};

/**
 * Calls `visit` for each element and attribute that a fixed value writes.
 * That's every attribute but events and creation attributes. `<model>` is
 * left to its own tests, since it needs a loaded scene to be made.
 */
function forEachAttribute(visit: (tag: string, key: string) => void): void {
    for (const tag in pixi3dElements) {
        if (tag === 'model') continue;
        const attributes = pixi3dElements[tag as keyof typeof pixi3dElements].attributes as Record<string, { kind: string }>;
        for (const key in attributes) {
            const kind = attributes[key].kind;
            if (kind !== 'event' && kind !== 'creation') visit(tag, key);
        }
    }
}

function sampleFor(tag: string, key: string): Sample | undefined {
    return (tag === 'batchedMesh' ? BATCH_SAMPLES[key] : undefined) ?? SAMPLES[key];
}

function isEqual(actual: unknown, expected: unknown): boolean {
    if (typeof expected === 'number' && typeof actual === 'number') return Math.abs(actual - expected) < 1e-6;
    if (typeof expected !== 'object') return Object.is(actual, expected);
    return actual === expected || JSON.stringify(actual) === JSON.stringify(expected);
}
