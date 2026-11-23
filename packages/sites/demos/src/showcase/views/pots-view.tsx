/** @jsxImportSource @mvtjs/pixi-3d */

import { ConeGeometry, type Container3D, CylinderGeometry, IcosahedronGeometry, Material3D } from '@pixi/3d';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PotsViewBindings {
    /** Where each pot stands, in metres. */
    readonly spots: readonly { readonly x: number; readonly z: number }[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The gallery's plants, each a tall plant in a white pot: a slim trunk with
 * a crown of leafy balls and a few spiky fronds round its foot, each in a
 * shade of green. They all share one set of shapes and materials.
 */
export function PotsView({ spots }: PotsViewBindings): Container3D {
    const pot = new Material3D({ baseColor: 0xf0eee8, roughness: 0.4 });
    const soil = new Material3D({ baseColor: 0x4a3626, roughness: 1 });
    const bark = new Material3D({ baseColor: 0x6b4a2e, roughness: 0.9 });
    const leaves = LEAF_COLORS.map((color) => new Material3D({ baseColor: color, roughness: 0.8, flatShading: true }));
    const potBody = new CylinderGeometry({ radiusTop: 0.3, radiusBottom: 0.22, height: POT_HEIGHT, radialSegments: 24 });
    const soilTop = new CylinderGeometry({ radiusTop: 0.27, radiusBottom: 0.27, height: 0.02, radialSegments: 24 });
    const trunk = new CylinderGeometry({ radiusTop: 0.03, radiusBottom: 0.045, height: TRUNK_HEIGHT, radialSegments: 8 });
    // Each ball of leaves has its own size, so each has its own geometry. Every frond is the same shape, so the fronds share one
    const balls = CROWN.map((ball) => new IcosahedronGeometry({ radius: ball.radius, detail: 1 }));
    const frondShape = new ConeGeometry({ radius: 0.05, height: 0.5, radialSegments: 5 });
    return (
        <group owns={[pot, soil, bark, ...leaves, potBody, soilTop, trunk, ...balls, frondShape]}>
            {spots.map((spot) => (
                <group x={spot.x} z={spot.z}>
                    <mesh geometry={potBody} material={pot} y={POT_HEIGHT / 2} />
                    <mesh geometry={soilTop} material={soil} y={POT_HEIGHT - 0.03} />
                    <mesh geometry={trunk} material={bark} y={POT_HEIGHT + TRUNK_HEIGHT / 2} />
                    {CROWN.map((ball, i) => (
                        <mesh
                            geometry={balls[i]}
                            material={leaves[i % leaves.length]}
                            x={ball.x}
                            y={POT_HEIGHT + TRUNK_HEIGHT + ball.y}
                            z={ball.z}
                        />
                    ))}
                    {FRONDS.map((frond, i) => (
                        <mesh
                            geometry={frondShape}
                            material={leaves[(i + 1) % leaves.length]}
                            x={Math.cos(frond) * 0.12}
                            y={POT_HEIGHT + 0.2}
                            z={Math.sin(frond) * 0.12}
                            rotationX={Math.sin(frond) * 0.5}
                            rotationZ={-Math.cos(frond) * 0.5}
                        />
                    ))}
                </group>
            ))}
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const POT_HEIGHT = 0.55;
const TRUNK_HEIGHT = 0.7;
const LEAF_COLORS: readonly number[] = [0x3f8f3a, 0x2f7a3f, 0x5aa646];
/** The balls of leaves in the plant's crown, from the top of its trunk. */
const CROWN: readonly { x: number; y: number; z: number; radius: number }[] = [
    { x: 0, y: 0.25, z: 0, radius: 0.3 },
    { x: 0.2, y: 0.05, z: 0.08, radius: 0.22 },
    { x: -0.18, y: 0.08, z: -0.1, radius: 0.22 },
    { x: 0.04, y: -0.05, z: -0.2, radius: 0.2 },
    { x: -0.06, y: 0.5, z: 0.08, radius: 0.18 },
];
/** The ways the fronds round the trunk's foot lean out, as angles round it. */
const FRONDS: readonly number[] = [0, 1.3, 2.5, 3.7, 5];
