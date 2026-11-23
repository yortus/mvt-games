/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, CubeGeometry, Material3D } from '@pixi/3d';
import { BENCH_HEIGHT, BENCH_LENGTH, BENCH_WIDTH } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BenchesViewBindings {
    /** Where each bench stands, in metres. */
    readonly spots: readonly { readonly x: number; readonly z: number }[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The gallery's benches, along their corridors, each a thick oak seat on two dark steel legs. They all share one set of shapes and materials. */
export function BenchesView({ spots }: BenchesViewBindings): Container3D {
    const oak = new Material3D({ baseColor: 0xc89a62, roughness: 0.5 });
    const steel = new Material3D({ baseColor: 0x2b2d31, roughness: 0.35, metallic: 0.6 });
    const seat = new CubeGeometry({ width: BENCH_LENGTH, height: SEAT_THICKNESS, depth: BENCH_WIDTH });
    const leg = new CubeGeometry({ width: LEG_THICKNESS, height: BENCH_HEIGHT - SEAT_THICKNESS, depth: BENCH_WIDTH - 0.06 });
    const legY = (BENCH_HEIGHT - SEAT_THICKNESS) / 2;
    const legX = BENCH_LENGTH / 2 - 0.2;
    return (
        <group owns={[oak, steel, seat, leg]}>
            {spots.map((spot) => (
                <group x={spot.x} z={spot.z}>
                    <mesh geometry={seat} material={oak} y={BENCH_HEIGHT - SEAT_THICKNESS / 2} />
                    <mesh geometry={leg} material={steel} x={-legX} y={legY} />
                    <mesh geometry={leg} material={steel} x={legX} y={legY} />
                </group>
            ))}
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SEAT_THICKNESS = 0.08;
const LEG_THICKNESS = 0.05;
