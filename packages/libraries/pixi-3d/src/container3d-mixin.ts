import { Container3D } from '@pixi/3d';
// Imported from @mvtjs/pixi, which registers Pixi's containers too. A 3D scene always sits on a Pixi stage.
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { registerRenderer } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

declare module '@mvtjs/utils' {
    interface RendererViews {
        /** PixiJS 3D scene nodes. Groups, meshes, models, lights and cameras all extend `Container3D`. */
        pixi3d: Container3D;
    }
}

/**
 * Registers PixiJS 3D's scene nodes with `registerRenderer`, on
 * `Container3D.prototype`, so that `updateView` and `refreshView` walk them.
 * A `Container3D` is not a Pixi `Container`. It extends `EventEmitter`, and
 * a 3D scene hangs off a `View3D`'s `root` rather than its children. So the
 * 3D tree is registered as a renderer of its own, and `connectScene` joins
 * it to the 2D stage that the `View3D` is on.
 *
 * The registration runs as the module loads, so every node has the private
 * fields' defaults before any node is given a method or walked.
 */
const { invalidate } = registerRenderer<Container3D>({
    prototype: Container3D.prototype,
    children: (node) => node.children,
    // PixiJS 3D types `parent` as `Container3D | null`; the walk tests truthiness.
    parent: (node) => node.parent,
    describe: (node) => (node.label ? `'${node.label}'` : `(${node.constructor.name})`),
});
wrapStructuralMethods();

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Wraps the membership-changing methods on `Container3D.prototype`, so the
 * cached method lists are cleared when the tree changes. This was checked
 * against PixiJS 3D 0.1.0, whose methods follow the same paths as Pixi's.
 * `addChild` and `removeChild` handle one child at a time. `addChildAt` and
 * `removeChildren` change `children` directly. `setChildIndex`,
 * `reparentChild`, `reparentChildAt`, `replaceChild`, `removeChildAt`,
 * `removeFromParent` and `destroy` all call those four. Moving a node among
 * its own siblings, as `swapChildren` does, doesn't clear the lists, because
 * the walk doesn't guarantee any order among siblings.
 *
 * Like @mvtjs/pixi's wrappers, these use `this`, which the style guide
 * otherwise rules out. A wrapped prototype method can reach its instance only
 * through `this`.
 */
function wrapStructuralMethods(): void {
    const proto = Container3D.prototype;
    const baseAddChild = proto.addChild;
    const baseAddChildAt = proto.addChildAt;
    const baseRemoveChild = proto.removeChild;
    const baseRemoveChildren = proto.removeChildren;
    const baseDestroy = proto.destroy;

    proto.addChild = function addChild(this: Container3D, ...children: Container3D[]): Container3D {
        // The base implementation calls `this.addChild` per child, so each one
        // is covered by the single-child path below.
        if (children.length !== 1) return baseAddChild.apply(this, children);
        const child = children[0];
        // A child of another parent leaves it through that parent's
        // `removeChild`, which clears that side.
        const isReorder = child.parent === this;
        const result = baseAddChild.call(this, child);
        if (!isReorder) invalidate(this);
        return result;
    } as typeof proto.addChild;

    proto.addChildAt = function addChildAt(this: Container3D, child: Container3D, index: number): Container3D {
        const isReorder = child.parent === this;
        const result = baseAddChildAt.call(this, child, index);
        if (!isReorder) invalidate(this);
        return result;
    } as typeof proto.addChildAt;

    proto.removeChild = function removeChild(this: Container3D, ...children: Container3D[]): Container3D {
        if (children.length !== 1) return baseRemoveChild.apply(this, children);
        const wasChild = children[0].parent === this;
        const result = baseRemoveChild.call(this, children[0]);
        if (wasChild) invalidate(this);
        return result;
    } as typeof proto.removeChild;

    proto.removeChildren = function removeChildren(
        this: Container3D,
        beginIndex?: number,
        endIndex?: number,
    ): Container3D[] {
        const removed = baseRemoveChildren.call(this, beginIndex, endIndex);
        if (removed.length > 0) invalidate(this);
        return removed;
    };

    proto.destroy = function destroy(this: Container3D, options?: Parameters<typeof baseDestroy>[0]): void {
        // Clearing the methods stops a destroyed node from being called
        // again. Detaching it isn't enough, because the node passed to
        // `updateView` itself has no parent to be detached from. The methods
        // are cleared first, so the setters can still walk up through the
        // ancestors.
        setUpdate(this, undefined);
        setRefresh(this, undefined);
        baseDestroy.call(this, options);
    };
}
