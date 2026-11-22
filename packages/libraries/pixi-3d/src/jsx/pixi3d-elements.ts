import { AmbientLight, BatchedMesh3D, Camera3D, Container3D, DirectionalLight, Mesh3D, Model3D, PointLight, SpotLight, Sprite3D } from '@pixi/3d';
import type { BaseMaterial3D, Geometry3D, HitVolume3DInput, InstanceDataOptions, Light, LightShadowOptions } from '@pixi/3d';
import type { MaterialOverrides, Pointer3DEvent, Scene3DSource, Wheel3DEvent } from '@pixi/3d';
import type { ColorSource, PointData } from 'pixi.js';
import { attributesOf, creation, defineElements, element, event } from '@mvtjs/utils/jsx';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A point or vector that the model owns, which `position` and `lookAt` read every frame. */
export interface Vector3Like {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** A rotation, as a quaternion that the model owns, which `quaternion` copies from every frame. */
export interface QuaternionLike {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

// An attribute that's a plain assignment names its property, and refresh
// methods assign that property inline (see `attributesOf`). Every other
// attribute is an apply function.
//
// Each attribute is written only as often as it needs to be. Transforms are
// per axis, like Pixi's `x` and `scaleX`, because a view works each one out
// from the model's domain coordinates. They're written every frame, since
// PixiJS 3D's vectors skip a value that hasn't changed. The whole-vector
// `position` and `quaternion` attributes copy from an object that the model
// owns, so a refresh doesn't build a new vector. Anything that rebuilds GPU
// state, such as a texture, a mode or a shadow setting, is written only when
// it changes.

const node = attributesOf<Container3D>();
const mesh = attributesOf<Mesh3D>();
const sprite = attributesOf<Sprite3D>();
const batch = attributesOf<BatchedMesh3D>();
const model = attributesOf<Model3D>();
const light = attributesOf<Light>();
const pointLight = attributesOf<PointLight>();
const spotLight = attributesOf<SpotLight>();
const camera = attributesOf<Camera3D>();

/** Attributes every PixiJS 3D element accepts. */
const nodeAttributes = {
    x: node.everyFrame('x'),
    y: node.everyFrame('y'),
    z: node.everyFrame('z'),
    position: node.everyFrame((e, v: Vector3Like) => { e.position.copyFrom(v); }),
    rotationX: node.everyFrame((e, v: number) => { e.rotation.x = v; }),
    rotationY: node.everyFrame((e, v: number) => { e.rotation.y = v; }),
    rotationZ: node.everyFrame((e, v: number) => { e.rotation.z = v; }),
    quaternion: node.everyFrame((e, v: QuaternionLike) => { e.quaternion.copyFrom(v); }),
    // Turns the node to face a point in its parent's space. Attributes are
    // applied in the order that they're written, so write `lookAt` after the
    // position. The node then faces the point from its new position.
    lookAt: node.everyFrame((e, v: Vector3Like) => { e.lookAt(v); }),
    scale: node.everyFrame((e, v: number) => { e.scale.set(v, v, v); }),
    scaleX: node.everyFrame((e, v: number) => { e.scale.x = v; }),
    scaleY: node.everyFrame((e, v: number) => { e.scale.y = v; }),
    scaleZ: node.everyFrame((e, v: number) => { e.scale.z = v; }),
    // The point, in the node's own space, that it turns and scales about
    originX: node.everyFrame((e, v: number) => { e.origin.x = v; }),
    originY: node.everyFrame((e, v: number) => { e.origin.y = v; }),
    originZ: node.everyFrame((e, v: number) => { e.origin.z = v; }),
    label: node.fixed('label'),
    cursor: node.everyFrame('cursor'),
    eventMode: node.fixed('eventMode'),
    // A pointer is tested against the node's bounding box by default.
    // `'geometry'` tests each triangle, and fills in the hit's uv. A shape,
    // such as a sphere, tests that shape.
    // eslint-disable-next-line @mvtjs/no-null -- PixiJS 3D clears a hit volume with `null`
    hitVolume: node.onChange((e, v: HitVolume3DInput | undefined) => { e.hitVolume = v ?? null; }),
    interactiveChildren: node.onChange('interactiveChildren'),
    onPointerDown: event<Pointer3DEvent>('pointerdown'),
    onPointerUp: event<Pointer3DEvent>('pointerup'),
    onPointerUpOutside: event<Pointer3DEvent>('pointerupoutside'),
    onPointerCancel: event<Pointer3DEvent>('pointercancel'),
    onPointerTap: event<Pointer3DEvent>('pointertap'),
    onPointerOver: event<Pointer3DEvent>('pointerover'),
    onPointerOut: event<Pointer3DEvent>('pointerout'),
    onPointerEnter: event<Pointer3DEvent>('pointerenter'),
    onPointerLeave: event<Pointer3DEvent>('pointerleave'),
    onPointerMove: event<Pointer3DEvent>('pointermove'),
    onGlobalPointerMove: event<Pointer3DEvent>('globalpointermove'),
    onWheel: event<Wheel3DEvent>('wheel'),
};

/** Attributes of a mesh, and of a sprite, which is a kind of mesh. */
const meshShadowAttributes = {
    castShadow: mesh.onChange('castShadow'),
    receiveShadow: mesh.onChange('receiveShadow'),
    // Turns the mesh about its origin to face the camera
    billboardMode: mesh.onChange('billboardMode'),
};

/** Attributes of every light. */
const lightAttributes = {
    color: light.onChange((e, v: ColorSource) => { e.color = v; }),
    intensity: light.everyFrame('intensity'),
};

/** Attributes of a light that can cast a shadow. */
const shadowAttributes = {
    castShadow: light.onChange('castShadow'),
    // Copied into the light's `shadow`, which is then redrawn. PixiJS 3D
    // reads these fields the next time it draws the shadow.
    shadow: light.onChange((e, v: LightShadowOptions | undefined) => { writeShadow(e, v); }),
};

/**
 * PixiJS 3D's intrinsic elements. Geometry and material are attributes, not
 * child elements, so JSX children stay one to one with scene-graph children.
 * A mesh's colour comes from its material. A material is usually shared, so
 * the view that owns the material is the one that changes its colour.
 *
 * A `Scene3DView` draws from the first `<camera>` in its scene.
 */
export const pixi3dElements = defineElements({
    group: element(() => new Container3D(), nodeAttributes),
    mesh: element(() => new Mesh3D(), {
        ...nodeAttributes,
        ...meshShadowAttributes,
        geometry: mesh.onChange('geometry'),
        material: mesh.onChange('material'),
        // Morph target weights, for a geometry that has morph targets
        weights: mesh.onChange('weights'),
    }),
    // A `<sprite3d>` is a picture in the scene. Unlike a 2D sprite drawn
    // over the scene, it can be hidden by walls and other meshes. With
    // `billboardMode`, it faces the camera.
    sprite3d: element(() => new Sprite3D(), {
        ...nodeAttributes,
        ...meshShadowAttributes,
        texture: sprite.onChange('texture'),
        tint: sprite.onChange((e, v: ColorSource) => { e.tint = v; }),
        alpha: sprite.onChangeNumber('alpha'),
        alphaMode: sprite.onChange('alphaMode'),
        alphaCutoff: sprite.onChangeNumber('alphaCutoff'),
        anchor: sprite.onChange((e, v: PointData | number) => { e.anchor = v; }),
        width: sprite.onChangeNumber('width'),
        height: sprite.onChangeNumber('height'),
        // How big a texture pixel is in the scene, in world units, while `width` and `height` are unset
        pixelSize: sprite.onChangeNumber('pixelSize'),
    }),
    // A `<batchedMesh>` draws many copies of a mesh as one. The JSX creates
    // the batch, and your view writes each copy's matrix, in an `onRefresh`
    // step or in a plain TypeScript view. The `geometry` and `material`
    // attributes set the geometry and material of every copy at once.
    batchedMesh: element(
        (values: BatchedMeshCreation) => new BatchedMesh3D({ size: values.size, instanceData: values.instanceData }),
        {
            ...nodeAttributes,
            size: creation<number>({ required: true }),
            instanceData: creation<InstanceDataOptions>(),
            cull: batch.onChange('cull'),
            geometry: batch.onChange((e, v: Geometry3D) => {
                for (let i = 0; i < e.size; i++) e.setGeometryAt(i, v);
            }),
            material: batch.onChange((e, v: BaseMaterial3D) => {
                for (let i = 0; i < e.size; i++) e.setMaterialAt(i, v);
            }),
        },
    ),
    // A `<model>` is a loaded glTF scene. Its animation never moves on its
    // own. `clip` names the clip that it shows, and `clipTimeMs` the moment
    // in that clip. Both come from bindings, so the model's pose changes only
    // when a binding's value changes.
    model: element(
        (values: ModelCreation) => new Model3D({
            source: values.source,
            scene: values.scene,
            castShadow: values.castShadow,
            receiveShadow: values.receiveShadow,
            autoUpdate: false,
            autoPlay: false,
        }),
        {
            ...nodeAttributes,
            source: creation<Scene3DSource>({ required: true }),
            // Which of the file's scenes, by name, when it has more than one
            scene: creation<string>(),
            castShadow: creation<boolean>(),
            receiveShadow: creation<boolean>(),
            materials: model.onChange((e, v: MaterialOverrides | undefined) => { e.materials = v; }),
            clip: model.onChange((e, v: string | undefined) => { poseModel(e, v, clipTimeOf(e), clipLoopsOf(e)); }),
            clipTimeMs: model.onChangeNumber((e, v) => { poseModel(e, clipOf(e), v, clipLoopsOf(e)); }),
            // Whether a time past the clip's end wraps round to its start (the
            // default), or holds the clip's last pose
            clipLoops: model.onChange((e, v: boolean) => { poseModel(e, clipOf(e), clipTimeOf(e), v); }),
        },
    ),
    camera: element(() => new Camera3D(), {
        ...nodeAttributes,
        mode: camera.onChange('mode'),
        fov: camera.onChangeNumber('fov'),
        near: camera.onChangeNumber('near'),
        far: camera.onChangeNumber('far'),
        // The height the camera sees, in world units, in `'orthographic'` mode
        orthographicSize: camera.onChangeNumber('orthographicSize'),
        zoom: camera.onChangeNumber('zoom'),
    }),
    ambientLight: element(() => new AmbientLight(), { ...nodeAttributes, ...lightAttributes }),
    directionalLight: element(() => new DirectionalLight(), { ...nodeAttributes, ...lightAttributes, ...shadowAttributes }),
    pointLight: element(() => new PointLight(), {
        ...nodeAttributes,
        ...lightAttributes,
        range: pointLight.onChangeNumber('range'),
        // The size of the light's bulb, in world units, which softens its highlights
        radius: pointLight.onChangeNumber('radius'),
    }),
    spotLight: element(() => new SpotLight(), {
        ...nodeAttributes,
        ...lightAttributes,
        ...shadowAttributes,
        range: spotLight.onChangeNumber('range'),
        radius: spotLight.onChangeNumber('radius'),
        // The cone's half angle, in degrees, and how much of its edge fades
        coneAngle: spotLight.onChangeNumber('coneAngle'),
        penumbra: spotLight.onChangeNumber('penumbra'),
    }),
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// A `create` that reads its creation attributes names its parameter's type,
// so TypeScript can infer the element's type before it checks the table.

/** The creation attributes of a `<batchedMesh>`. */
interface BatchedMeshCreation {
    readonly size: number;
    readonly instanceData?: InstanceDataOptions;
}

/** The creation attributes of a `<model>`. */
interface ModelCreation {
    readonly source: Scene3DSource;
    readonly scene?: string;
    readonly castShadow?: boolean;
    readonly receiveShadow?: boolean;
}

/** The shadow settings that PixiJS 3D starts a light with, which `writeShadow` restores when an option is absent. */
const SHADOW_DEFAULTS = { update: 1, lambda: 0.5 } as const;

/** Writes a light's shadow settings, resetting each absent one to its default, then calls `refreshShadows` so the shadow is redrawn. */
function writeShadow(target: Light, options: LightShadowOptions | undefined): void {
    const shadow = target.shadow;
    shadow.bounds = options?.bounds;
    shadow.cascades = options?.cascades;
    shadow.update = options?.update ?? SHADOW_DEFAULTS.update;
    shadow.maxDistance = options?.maxDistance;
    shadow.lambda = options?.lambda ?? SHADOW_DEFAULTS.lambda;
    shadow.bias = options?.bias;
    shadow.normalBias = options?.normalBias;
    target.refreshShadows();
}

/** A model's clip, time and looping, as its attributes last wrote them. */
interface ModelPose {
    clip: string | undefined;
    timeMs: number;
    loops: boolean;
}

/** Stores each model's pose beside it, since a refresh writes one attribute at a time. */
const modelPoses = new WeakMap<Model3D, ModelPose>();

function clipOf(target: Model3D): string | undefined {
    return modelPoses.get(target)?.clip;
}

function clipTimeOf(target: Model3D): number {
    return modelPoses.get(target)?.timeMs ?? 0;
}

function clipLoopsOf(target: Model3D): boolean {
    return modelPoses.get(target)?.loops ?? true;
}

/**
 * Poses a model at a moment in a clip. The clip's state is moved to the
 * time and stopped there, so the player never advances it.
 */
function poseModel(target: Model3D, clip: string | undefined, timeMs: number, loops: boolean): void {
    let pose = modelPoses.get(target);
    if (pose === undefined) {
        pose = { clip, timeMs, loops };
        modelPoses.set(target, pose);
    }
    const player = target.player;
    if (pose.clip !== clip && pose.clip !== undefined) player?.getState(pose.clip).stop();
    pose.clip = clip;
    pose.timeMs = timeMs;
    pose.loops = loops;
    if (clip === undefined || player === undefined) return;
    const state = player.getState(clip);
    const duration = state.animation.duration;
    const seconds = timeMs / 1000;
    if (duration <= 0) state.gotoAndStop(0);
    // `%` keeps the sign of a time before the clip's start, so a looping clip wraps it round into the clip
    else if (loops) state.gotoAndStop(((seconds % duration) + duration) % duration);
    else state.gotoAndStop(Math.max(0, Math.min(seconds, duration)));
}
