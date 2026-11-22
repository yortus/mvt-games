import { CubeGeometry, CylinderGeometry, FlatMaterial, type Geometry3D, Material3D, SphereGeometry } from '@pixi/3d';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the orrery is made of, and the shapes it's turned from. The orrery's
 * view makes one set and passes it down to the views of its parts, which
 * draw with it, scaling the shapes to size. The orrery's view frees the set
 * when it's destroyed. The views of its parts never free it.
 */
export interface OrreryParts {
    /** Polished brass, for the gears and arms. */
    readonly brass: Material3D;
    /** Darker, older brass, for the bridge and pillar. */
    readonly darkBrass: Material3D;
    /** Blued steel, for the arbors and the spindle. */
    readonly steel: Material3D;
    /** Dark polished wood, for the plinth and the crank's handle. */
    readonly wood: Material3D;
    /** Near-black ebony, for the plate the arbors stand on, so the brass shows up against it. */
    readonly ebony: Material3D;
    /** The sun's glow. It's unlit, so it shows the same colour all over. */
    readonly sunGlow: FlatMaterial;
    /** A cylinder one unit high and one in radius, standing on the Y axis, centred on the origin, for rods and tubes. */
    readonly cylinder: CylinderGeometry;
    /** A sphere one unit in radius, for worlds, knobs and weights. */
    readonly sphere: SphereGeometry;
    /** A cube one unit on each side, centred on the origin, for arms and bars. */
    readonly cube: CubeGeometry;
    /** Every material and shape in the set, for the `owns` of the view that made it. */
    readonly resources: readonly (Geometry3D | Material3D | FlatMaterial)[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the orrery's materials and shapes. The view that calls it owns them, and lists `resources` in its `owns`. */
export function createOrreryParts(): OrreryParts {
    const materials = {
        brass: new Material3D({ baseColor: 0xd9a842, metallic: 1, roughness: 0.32 }),
        darkBrass: new Material3D({ baseColor: 0x9c7430, metallic: 1, roughness: 0.45 }),
        steel: new Material3D({ baseColor: 0x6a7488, metallic: 1, roughness: 0.3 }),
        wood: new Material3D({ baseColor: 0x4a2414, roughness: 0.45 }),
        ebony: new Material3D({ baseColor: 0x1a110c, roughness: 0.4 }),
        sunGlow: new FlatMaterial({ baseColor: 0xffd27a }),
    };
    const shapes = {
        cylinder: new CylinderGeometry({ radiusTop: 1, radiusBottom: 1, height: 1, radialSegments: 20 }),
        sphere: new SphereGeometry({ radius: 1, widthSegments: 32, heightSegments: 16 }),
        cube: new CubeGeometry({ width: 1, height: 1, depth: 1 }),
    };
    return {
        ...materials,
        ...shapes,
        resources: [...Object.values(materials), ...Object.values(shapes)],
    };
}
