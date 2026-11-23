/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, ConeGeometry, CubeGeometry, CylinderGeometry, Material3D, PlaneGeometry, TorusGeometry } from '@pixi/3d';
import { createDeskTexture } from './desk-texture';

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The desk the paper lies on: a wooden top, a mug of tea beyond the paper's
 * top left corner, and a pencil, sharpened, near its foot, for the puzzles.
 * It never changes, so it needs neither an update nor a refresh step.
 */
export function DeskView(): Container3D {
    const grain = createDeskTexture();
    const wood = new Material3D({ baseColorTexture: grain, roughness: 0.6 });
    const mug = new Material3D({ baseColor: 0x2f6f8f, roughness: 0.35 });
    const tea = new Material3D({ baseColor: 0x6b3f1f, roughness: 0.2 });
    const pencil = new Material3D({ baseColor: 0xf2b632, roughness: 0.5 });
    const shavings = new Material3D({ baseColor: 0xe8c9a0, roughness: 0.8 });
    const lead = new Material3D({ baseColor: 0x2a2a2a, roughness: 0.4 });
    const rubber = new Material3D({ baseColor: 0xe07a8a, roughness: 0.7 });
    const top = new PlaneGeometry({ width: DESK_WIDTH, height: DESK_DEPTH, flipV: true });
    const mugBody = new CylinderGeometry({ radiusTop: 0.042, radiusBottom: 0.038, height: MUG_HEIGHT, radialSegments: 28 });
    const teaTop = new CylinderGeometry({ radiusTop: 0.037, radiusBottom: 0.037, height: 0.002, radialSegments: 28 });
    const handle = new TorusGeometry({ radius: 0.026, tube: 0.007, radialSegments: 10, tubularSegments: 20 });
    const shaft = new CylinderGeometry({ radiusTop: 0.0042, radiusBottom: 0.0042, height: PENCIL_LENGTH, radialSegments: 6 });
    const point = new ConeGeometry({ radius: 0.0042, height: 0.018, radialSegments: 6 });
    const tip = new ConeGeometry({ radius: 0.0016, height: 0.0068, radialSegments: 6 });
    const end = new CubeGeometry({ width: 0.012, height: 0.0084, depth: 0.0084 });

    return (
        <group owns={[grain, wood, mug, tea, pencil, shavings, lead, rubber, top, mugBody, teaTop, handle, shaft, point, tip, end]}>
            {/* A plane faces +z, so the top is turned to face up */}
            <mesh geometry={top} material={wood} rotationX={-Math.PI / 2} />
            <group x={-0.52} z={-0.34}>
                <mesh geometry={mugBody} material={mug} y={MUG_HEIGHT / 2} />
                <mesh geometry={teaTop} material={tea} y={MUG_HEIGHT - 0.008} />
                {/* A torus lies flat, so the handle is stood on its edge, at the mug's side */}
                <mesh geometry={handle} material={mug} x={0.045} y={MUG_HEIGHT * 0.55} rotationX={Math.PI / 2} />
            </group>
            {/* The pencil lies along x, a cylinder and a cone turned onto their sides */}
            <group x={0.18} y={0.004} z={0.36} rotationY={0.25}>
                <mesh geometry={shaft} material={pencil} rotationZ={Math.PI / 2} />
                <mesh geometry={point} material={shavings} x={-PENCIL_LENGTH / 2 - 0.009} rotationZ={Math.PI / 2} />
                <mesh geometry={tip} material={lead} x={-PENCIL_LENGTH / 2 - 0.0146} rotationZ={Math.PI / 2} />
                <mesh geometry={end} material={rubber} x={PENCIL_LENGTH / 2 + 0.006} />
            </group>
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DESK_WIDTH = 2.6;
const DESK_DEPTH = 1.8;
const MUG_HEIGHT = 0.1;
const PENCIL_LENGTH = 0.15;
