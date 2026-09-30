import { Object3D } from 'three';
import {
    createDestroyRegistry, createScenePasses, type RefreshMethod, type SubtreeInfo, type UpdateMethod,
} from '../mvt-utils';

// ---------------------------------------------------------------------------
// Type Augmentation
// ---------------------------------------------------------------------------

// three's `Object3D`, named outside the augmentation, where `Object3D` means
// the interface being declared.
type ThreeObject3D = Object3D;

declare module 'three/src/core/Object3D.js' {
    // Merges with the class, so it repeats the class's type parameter.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Object3D<TEventMap extends Object3DEventMap = Object3DEventMap> {
        /**
         * Advances this object's cosmetic presentation state. Run by
         * `updateScene`, every tick, whether or not the object is visible or
         * in view. Return `SKIP_DESCENDANTS` to freeze its descendants.
         */
        onUpdate: UpdateMethod | undefined;
        /**
         * Syncs this object from model state. Run by `refreshScene`, before any
         * of its descendants', whether or not it is visible or in view. Must be
         * idempotent. Return `SKIP_DESCENDANTS` to skip its descendants.
         */
        onRefresh: RefreshMethod | undefined;

        /** @internal Backing field for `onUpdate`. */
        _mvtOnUpdate: UpdateMethod | undefined;
        /** @internal Backing field for `onRefresh`. */
        _mvtOnRefresh: RefreshMethod | undefined;
        /** @internal Does this subtree hold any `onUpdate`? `undefined` = dirty. */
        _mvtHasUpdate: boolean | undefined;
        /** @internal Update walk for this subtree. `undefined` = dirty. */
        _mvtUpdate: SubtreeInfo<ThreeObject3D> | undefined;
        /** @internal Does this subtree hold any `onRefresh`? `undefined` = dirty. */
        _mvtHasRefresh: boolean | undefined;
        /** @internal Refresh walk for this subtree. `undefined` = dirty. */
        _mvtRefresh: SubtreeInfo<ThreeObject3D> | undefined;
    }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/**
 * The scene passes over three.js objects: the generic memoised walk
 * (`../mvt-utils`), told how to read an object's children and parent.
 */
export const objectScenePasses = createScenePasses<Object3D>({
    children: (node) => node.children,
    parent: (node) => node.parent,
    describe: (node) => (node.name ? `'${node.name}'` : `(${node.type})`),
});

/**
 * Destroying three.js objects, which have no destroy of their own: runs each
 * `onDestroyed` callback in the subtree, stops the scene passes calling it,
 * and detaches it. Geometry, materials and textures are not disposed: the
 * view does not know who else uses them, so one that made them disposes them
 * in `onDestroyed`.
 */
export const objectDestroyRegistry = createDestroyRegistry<Object3D>({
    children: (node) => node.children,
    detach: (node) => {
        node.removeFromParent();
    },
});

// Installed at module load, before any object can be given a method: one
// assigned before the accessors exist becomes an own property that shadows
// them, and loses every invalidation.
installMixin();

function installMixin(): void {
    objectScenePasses.installMethods(Object3D.prototype);
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
 * Like pixi-mvt's wrappers, these use `this`, which the style guide otherwise
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
