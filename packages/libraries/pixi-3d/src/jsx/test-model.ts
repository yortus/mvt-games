import { type GltfFormat, parseGltf, type Scene3DSource } from '@pixi/3d';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Builds the model that the tests use. It's a glTF scene written here in
 * code, so every piece of art in the repo is made in the repo. It holds one
 * triangle, in a node named `'marker'`. Its one clip, `'rise'`, moves the
 * node in a straight line, from y = 0 at 0 s to y = 2 at 1 s.
 */
export function loadTestModel(): Promise<Scene3DSource> {
    const floats = new Float32Array([
        // The triangle's corners
        0, 0, 0, 1, 0, 0, 0, 1, 0,
        // The clip's key times, in seconds
        0, 1,
        // The node's position at each key time
        0, 0, 0, 0, 2, 0,
    ]);
    const gltf = {
        asset: { version: '2.0' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: 'marker', mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
        animations: [{
            name: 'rise',
            samplers: [{ input: 1, output: 2, interpolation: 'LINEAR' }],
            channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
        }],
        buffers: [{ byteLength: floats.byteLength }],
        bufferViews: [
            { buffer: 0, byteOffset: 0, byteLength: 36 },
            { buffer: 0, byteOffset: 36, byteLength: 8 },
            { buffer: 0, byteOffset: 44, byteLength: 24 },
        ],
        accessors: [
            { bufferView: 0, componentType: FLOAT, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
            { bufferView: 1, componentType: FLOAT, count: 2, type: 'SCALAR', min: [0], max: [1] },
            { bufferView: 2, componentType: FLOAT, count: 2, type: 'VEC3' },
        ],
    };
    return parseGltf(gltf as unknown as GltfFormat, [floats.buffer]);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** glTF's code for 32-bit floats. */
const FLOAT = 5126;
