/** @jsxImportSource @mvtjs/pixi-3d */
import { type Container3D, CubeGeometry, Material3D } from '@pixi/3d';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CrateSceneViewBindings {
    /** How far through its turn the crate is, from 0 up to 1. */
    readonly progress: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A crate that turns once each cycle, lit by a sun from the upper left.
 * The view makes the crate's shape and its paint itself, so it lists them
 * in `owns`. They're freed when the scene is destroyed. Each `lookAt`
 * comes after its node's position, since attributes are applied in order.
 */
export function CrateSceneView(bindings: CrateSceneViewBindings): Container3D {
    const box = new CubeGeometry({ width: 1.4, height: 1.4, depth: 1.4 });
    const wood = new Material3D({ baseColor: 0xc8894a, roughness: 0.7 });

    return (
        <group owns={[box, wood]}>
            <camera y={1.5} z={4.5} lookAt={ORIGIN} />
            <ambientLight intensity={0.4} />
            <directionalLight intensity={2.5} x={-3} y={5} z={4} lookAt={ORIGIN} />
            <mesh geometry={box} material={wood} rotationY={() => bindings.progress() * Math.PI * 2} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ORIGIN = { x: 0, y: 0, z: 0 };
