import { AmbientLight, DirectionalLight, Group, Mesh, PerspectiveCamera, PointLight } from 'three';
import type { ColorRepresentation, Light, Object3D } from 'three';
import { attributesOf, defineElements, element, event } from '@mvtjs/utils/jsx';
import type { PointerPickEvent } from '../pointer-picker';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A vector the model owns, which `position` copies from every frame. */
export interface Vector3Like {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** A rotation as a quaternion the model owns, which `quaternion` copies from every frame. */
export interface QuaternionLike {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

// Plain assignments name their property, which generated refresh methods
// assign inline; see `attributesOf`. The rest are apply functions. Transforms
// are per axis, like Pixi's `x` and `scaleX`, since a view computes each from
// the model's domain coordinates; whole-vector `position` and `quaternion`
// copy from an object the model owns, so no vector is built per frame.

const object = attributesOf<Object3D>();
const mesh = attributesOf<Mesh>();
const camera = attributesOf<PerspectiveCamera>();
const light = attributesOf<Light>();
const pointLight = attributesOf<PointLight>();

/** Attributes every three.js element accepts. */
const objectAttributes = {
    x: object.everyFrame((e, v: number) => { e.position.x = v; }),
    y: object.everyFrame((e, v: number) => { e.position.y = v; }),
    z: object.everyFrame((e, v: number) => { e.position.z = v; }),
    position: object.everyFrame((e, v: Vector3Like) => { e.position.copy(v); }),
    rotationX: object.everyFrame((e, v: number) => { e.rotation.x = v; }),
    rotationY: object.everyFrame((e, v: number) => { e.rotation.y = v; }),
    rotationZ: object.everyFrame((e, v: number) => { e.rotation.z = v; }),
    quaternion: object.everyFrame((e, v: QuaternionLike) => { e.quaternion.copy(v); }),
    scale: object.everyFrame((e, v: number) => { e.scale.setScalar(v); }),
    scaleX: object.everyFrame((e, v: number) => { e.scale.x = v; }),
    scaleY: object.everyFrame((e, v: number) => { e.scale.y = v; }),
    scaleZ: object.everyFrame((e, v: number) => { e.scale.z = v; }),
    renderOrder: object.everyFrame('renderOrder'),
    name: object.fixed('name'),
    castShadow: object.fixed('castShadow'),
    receiveShadow: object.fixed('receiveShadow'),
    frustumCulled: object.fixed('frustumCulled'),
    onClick: event<PointerPickEvent>('click'),
    onPointerDown: event<PointerPickEvent>('pointerdown'),
    onPointerUp: event<PointerPickEvent>('pointerup'),
    onPointerMove: event<PointerPickEvent>('pointermove'),
    onPointerOver: event<PointerPickEvent>('pointerover'),
    onPointerOut: event<PointerPickEvent>('pointerout'),
};

/** Attributes of every light. */
const lightAttributes = {
    color: light.onChange((e, v: ColorRepresentation) => { e.color.set(v); }),
    intensity: light.everyFrame('intensity'),
};

/**
 * three.js's intrinsic elements. Geometry and material are attributes, not
 * child elements, so JSX children stay one to one with scene-graph children.
 * There is no `color` on meshes: a material is usually shared, and whoever
 * owns it changes it.
 */
export const threeElements = defineElements({
    group: element(() => new Group(), objectAttributes),
    mesh: element(() => new Mesh(), {
        ...objectAttributes,
        geometry: mesh.onChange('geometry'),
        material: mesh.onChange('material'),
    }),
    perspectiveCamera: element(() => new PerspectiveCamera(), {
        ...objectAttributes,
        // Each recomputes the projection: two changing in one frame compute it twice
        fov: camera.onChangeNumber((e, v) => {
            e.fov = v;
            e.updateProjectionMatrix();
        }),
        aspect: camera.onChangeNumber((e, v) => {
            e.aspect = v;
            e.updateProjectionMatrix();
        }),
        near: camera.onChangeNumber((e, v) => {
            e.near = v;
            e.updateProjectionMatrix();
        }),
        far: camera.onChangeNumber((e, v) => {
            e.far = v;
            e.updateProjectionMatrix();
        }),
        zoom: camera.onChangeNumber((e, v) => {
            e.zoom = v;
            e.updateProjectionMatrix();
        }),
    }),
    ambientLight: element(() => new AmbientLight(), { ...objectAttributes, ...lightAttributes }),
    directionalLight: element(() => new DirectionalLight(), { ...objectAttributes, ...lightAttributes }),
    pointLight: element(() => new PointLight(), {
        ...objectAttributes,
        ...lightAttributes,
        distance: pointLight.onChangeNumber('distance'),
        decay: pointLight.onChangeNumber('decay'),
    }),
});
