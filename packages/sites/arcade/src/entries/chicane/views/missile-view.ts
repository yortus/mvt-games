import { ConeGeometry, Container3D, CylinderGeometry, FlatMaterial, Material3D, Mesh3D, SphereGeometry } from '@pixi/3d';
import { ownResources, setRefresh } from '@mvtjs/pixi-3d';
import { type Missile, PLAYER_SHOOTER } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MissileViewBindings {
    /** The model's pool of missiles, read once. Its slots change as missiles are fired and blow up. */
    readonly missiles: readonly Missile[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The missiles in flight. Each is a slim body with a glowing tail and a
 * short trail of smoke behind it. Yours have yellow noses and the rivals'
 * have red ones, so you can tell at a glance which are coming for you. The
 * view keeps one missile's meshes for each of the model's slots.
 */
export function MissileView(bindings: MissileViewBindings): Container3D {
    const { missiles } = bindings;
    const parts = createParts();
    const view = ownResources(new Container3D({ label: 'missiles' }), Object.values(parts));
    const shapes: MissileShape[] = [];
    for (let i = 0; i < missiles.length; i++) {
        const shape = createShape(parts);
        shapes.push(shape);
        view.addChild(shape.group);
    }

    setRefresh(view, () => {
        for (let i = 0; i < shapes.length; i++) drawMissile(shapes[i], missiles[i]);
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How high above the ground a missile flies. */
const FLIGHT_HEIGHT = 0.8;
const BODY_LENGTH = 1.6;
const TRAIL_COUNT = 4;
/** How far apart the trail's puffs are, behind the missile. */
const TRAIL_SPACING = 1.3;

type MissileParts = ReturnType<typeof createParts>;

interface MissileShape {
    readonly group: Container3D;
    readonly yourNose: Mesh3D;
    readonly rivalNose: Mesh3D;
    readonly flame: Mesh3D;
}

function createParts() {
    return {
        // The cylinder and the cone stand along Y, so they're laid along X, the way the missile flies
        body: new CylinderGeometry({ radiusTop: 0.16, radiusBottom: 0.16, height: BODY_LENGTH, radialSegments: 8 }),
        nose: new ConeGeometry({ radius: 0.16, height: 0.45, radialSegments: 8 }),
        sphere: new SphereGeometry({ radius: 1, widthSegments: 8, heightSegments: 6 }),
        casing: new Material3D({ baseColor: 0xd8dbe0, roughness: 0.4, metallic: 0.5 }),
        yourPaint: new Material3D({ baseColor: 0xffd23f, roughness: 0.5 }),
        rivalPaint: new Material3D({ baseColor: 0xe02828, roughness: 0.5 }),
        flame: new FlatMaterial({ baseColor: 0xffb347 }),
        smoke: new Material3D({ baseColor: 0xc9c9c4, roughness: 1 }),
    };
}

function createShape(parts: MissileParts): MissileShape {
    const body = new Mesh3D({ geometry: parts.body, material: parts.casing, rotation: { x: 0, y: 0, z: -Math.PI / 2 } });
    const yourNose = new Mesh3D({ geometry: parts.nose, material: parts.yourPaint, rotation: { x: 0, y: 0, z: -Math.PI / 2 }, x: BODY_LENGTH / 2 + 0.2 });
    const rivalNose = new Mesh3D({ geometry: parts.nose, material: parts.rivalPaint, rotation: { x: 0, y: 0, z: -Math.PI / 2 }, x: BODY_LENGTH / 2 + 0.2 });
    const flame = new Mesh3D({ geometry: parts.sphere, material: parts.flame, x: -BODY_LENGTH / 2 - 0.2 });
    const trail: Mesh3D[] = [];
    for (let i = 0; i < TRAIL_COUNT; i++) {
        // The puffs grow as they fall behind, as smoke spreads
        const size = 0.25 + i * 0.12;
        const puff = new Mesh3D({ geometry: parts.sphere, material: parts.smoke, x: -BODY_LENGTH / 2 - (i + 1) * TRAIL_SPACING });
        puff.scale.set(size, size, size);
        trail.push(puff);
    }
    const group = new Container3D({ children: [body, yourNose, rivalNose, flame, ...trail], visible: false, y: FLIGHT_HEIGHT });
    return { group, yourNose, rivalNose, flame };
}

function drawMissile(shape: MissileShape, missile: Missile): void {
    shape.group.visible = missile.isActive;
    if (!missile.isActive) return;
    shape.group.x = missile.x;
    shape.group.z = missile.z;
    shape.group.rotation.y = -missile.heading;
    const isYours = missile.shooter === PLAYER_SHOOTER;
    shape.yourNose.visible = isYours;
    shape.rivalNose.visible = !isYours;
    // The flame flickers with how far the missile has flown, so it doesn't need a clock of its own
    const flicker = 0.35 + 0.1 * Math.sin((missile.x + missile.z) * 3.1);
    shape.flame.scale.set(flicker * 1.6, flicker, flicker);
}
