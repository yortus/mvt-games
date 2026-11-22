import { CubeGeometry, CylinderGeometry, type Geometry3D, Material3D } from '@pixi/3d';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The shapes and materials that every car draws with. The scene makes one
 * set for the whole field, and every `CarView` shares it, so the number of
 * cars doesn't change how many GPU resources there are. Each car draws
 * with the paint in `paints` at its colour's index.
 */
export interface CarParts {
    readonly body: Geometry3D;
    readonly nose: Geometry3D;
    readonly cabin: Geometry3D;
    readonly wing: Geometry3D;
    readonly tyre: Geometry3D;
    readonly spoke: Geometry3D;
    readonly glass: Material3D;
    readonly trim: Material3D;
    readonly tyreMaterial: Material3D;
    readonly rimMaterial: Material3D;
    /** One paint for each of the colours the set was made with, in the same order. */
    readonly paints: readonly Material3D[];
    /** Every shape and material in the set, for the `owns` of the view that made it. */
    readonly resources: readonly (Geometry3D | Material3D)[];
}

/** The wheels' radius, in metres, which the tyre is made to, and which the car view rolls them by. */
export const CAR_WHEEL_RADIUS = 0.38;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CarPartsOptions {
    /** The cars' paint colours, one paint made for each. */
    readonly colors: readonly number[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the cars' shapes and materials. The view that calls it owns them, and lists `resources` in its `owns`. */
export function createCarParts(options: CarPartsOptions): CarParts {
    const shapes = {
        body: new CubeGeometry({ width: 3.8, height: 0.42, depth: 1.8 }),
        nose: new CubeGeometry({ width: 0.7, height: 0.24, depth: 1.5 }),
        cabin: new CubeGeometry({ width: 1.5, height: 0.42, depth: 1.25 }),
        wing: new CubeGeometry({ width: 0.4, height: 0.06, depth: 1.85 }),
        tyre: new CylinderGeometry({ radiusTop: CAR_WHEEL_RADIUS, radiusBottom: CAR_WHEEL_RADIUS, height: 0.32, radialSegments: 16 }),
        spoke: new CubeGeometry({ width: 0.55, height: 0.1, depth: 0.34 }),
    };
    const materials = {
        glass: new Material3D({ baseColor: 0x1d2633, roughness: 0.15 }),
        trim: new Material3D({ baseColor: 0x222428, roughness: 0.6 }),
        tyreMaterial: new Material3D({ baseColor: 0x161616, roughness: 0.95 }),
        rimMaterial: new Material3D({ baseColor: 0xb8bcc4, roughness: 0.4, metallic: 0.6 }),
    };
    const paints = options.colors.map((color) => new Material3D({ baseColor: color, roughness: 0.35, metallic: 0.2 }));
    return {
        ...shapes,
        ...materials,
        paints,
        resources: [...Object.values(shapes), ...Object.values(materials), ...paints],
    };
}
