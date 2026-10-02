import { Object3D } from 'three';
import { createDestroyRegistry, createScenePasses } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/**
 * The scene passes over three.js objects: the generic memoised walk
 * (`ScenePasses` in `@mvtjs/utils`), told how to read an object's children
 * and parent. Unlike three's `onBeforeRender`, they run for objects that are
 * hidden or out of view, so a binding that brings an object back into view
 * still runs.
 */
const objectScenePasses = createScenePasses<Object3D>({
    children: (node) => node.children,
    parent: (node) => node.parent,
    describe: (node) => (node.name ? `'${node.name}'` : `(${node.type})`),
});

/** The tick API, typed to this renderer's nodes (see `./index.ts`). */
export const { tickScene, setTickMethods } = objectScenePasses;

/**
 * Destroying three.js objects, which have no destroy of their own
 * (`DestroyRegistry` in `@mvtjs/utils`): runs each
 * `onDestroyed` callback in the subtree, stops the scene passes calling it,
 * and detaches it. Geometry, materials and textures are not disposed: the
 * view does not know who else uses them, so one that made them disposes them
 * in `onDestroyed`.
 */
const objectDestroyRegistry = createDestroyRegistry<Object3D>({
    children: (node) => node.children,
    detach: (node) => {
        node.removeFromParent();
    },
});

export const { destroy: destroyObject, onDestroyed, isDestroyed } = objectDestroyRegistry;

// Installed at module load, so every object carries the scene passes' field
// defaults before any is given a method or walked.
installMixin();

function installMixin(): void {
    objectScenePasses.installFieldDefaults(Object3D.prototype);
    wrapStructuralMethods();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Wraps the membership-changing methods on `Object3D.prototype`, so the
 * scene passes' memoised walks are invalidated. Checked against three r186:
 * `removeFromParent` calls `parent.remove`, and `clear` calls
 * `remove(...children)`, so wrapping `remove` covers them. But `attach` does
 * not call `add`: it calls `removeFromParent` and then pushes onto `children`
 * itself, so it is wrapped too.
 *
 * Like @mvtjs/pixi's wrappers, these use `this`, which the style guide otherwise
 * rules out: a wrapped prototype method has no other way to reach its
 * instance.
 */
function wrapStructuralMethods(): void {
    const proto = Object3D.prototype;
    const baseAdd = proto.add;
    const baseRemove = proto.remove;
    const baseAttach = proto.attach;
    const invalidate = objectScenePasses.invalidate;

    proto.add = function add(this: Object3D, ...objects: Object3D[]): Object3D {
        // The base implementation calls `this.add` per object, so each one is
        // covered by the single-object path below.
        if (objects.length !== 1) return baseAdd.apply(this, objects);
        // Any previous parent is invalidated by `remove`, through the base
        // implementation's `removeFromParent`.
        const result = baseAdd.call(this, objects[0]);
        invalidate(this);
        return result;
    } as typeof proto.add;

    proto.remove = function remove(this: Object3D, ...objects: Object3D[]): Object3D {
        if (objects.length !== 1) return baseRemove.apply(this, objects);
        const wasChild = objects[0].parent === this;
        const result = baseRemove.call(this, objects[0]);
        if (wasChild) invalidate(this);
        return result;
    } as typeof proto.remove;

    proto.attach = function attach(this: Object3D, object: Object3D): Object3D {
        const result = baseAttach.call(this, object);
        invalidate(this);
        return result;
    } as typeof proto.attach;
}
