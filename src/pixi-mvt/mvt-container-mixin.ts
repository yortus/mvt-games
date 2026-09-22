import { Container, extensions } from 'pixi.js';
import type { RefreshMethod, SubtreeInfo, UpdateMethod } from './mvt-types';

// ---------------------------------------------------------------------------
// Type Augmentation
// ---------------------------------------------------------------------------

// Pixi's own mixins declare `PixiMixins.Container` without type parameters even
// though `Container.d.ts` references it as `PixiMixins.Container<C>`. That only
// survives because of `skipLibCheck`. Match the shipped pattern rather than
// trying to correct it.
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace PixiMixins {
        interface Container {
            /**
             * Advances this container's cosmetic presentation state.
             *
             * Fires every tick regardless of `visible`, `renderable` or
             * culling, because presentation state that stops advancing while
             * hidden is stale when it reappears. Return `SKIP_DESCENDANTS` to
             * deliberately freeze this container's descendants (a time-stopped
             * or inactive subtree); their state does not advance while skipped.
             */
            onUpdate: UpdateMethod | undefined;

            /**
             * Syncs this container's presentation output from model state.
             *
             * Called before any of this container's descendants' `onRefresh`.
             * Must be idempotent: it restates a fact rather than making a
             * change, so running it twice changes nothing.
             *
             * Nothing gates on visibility, so a view may set its own `visible`.
             * Return `SKIP_DESCENDANTS` to skip refreshing this container's
             * descendants (how a hidden or absent subtree opts out).
             */
            onRefresh: RefreshMethod | undefined;

            /** @internal Backing field for `onUpdate`. */
            _mvtOnUpdate: UpdateMethod | undefined;
            /** @internal Backing field for `onRefresh`. */
            _mvtOnRefresh: RefreshMethod | undefined;
            /** @internal Does this subtree hold any `onUpdate`? `undefined` = dirty. */
            _mvtHasUpdate: boolean | undefined;
            /** @internal Update walk for this subtree: preorder list plus skip table. `undefined` = dirty. */
            _mvtUpdate: SubtreeInfo | undefined;
            /** @internal Does this subtree hold any `onRefresh`? `undefined` = dirty. */
            _mvtHasRefresh: boolean | undefined;
            /** @internal Refresh walk for this subtree: preorder list plus skip table. `undefined` = dirty. */
            _mvtRefresh: SubtreeInfo | undefined;
        }
    }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

// Installed at module load rather than lazily on first use. An update or
// refresh method assigned before the accessors exist creates an own data
// property that shadows them for the life of that container, so its setter -
// and with it invalidation - would never fire again. Importing this module is
// the only ordering requirement, and ES modules evaluate imports before the
// importing module's own code.
installMixin();

/**
 * Adds `onUpdate` / `onRefresh` to `Container.prototype` and wraps the
 * structural methods so the memo fields can be invalidated.
 *
 * This file is the only one in the plugin that uses `this`, which the style
 * guide otherwise rules out. A prototype accessor and a wrapped prototype
 * method have no way to reach their instance without it. The exemption stops
 * here: the update and refresh methods are invoked as plain calls, so they stay
 * ordinary closures over their own state - the receiver they close over is
 * enough - exactly like a view's own `refresh`.
 */
function installMixin(): void {
    extensions.mixin(Container, createMixinSource());
    wrapStructuralMethods();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface MvtContainerMixin {
    _mvtOnUpdate: UpdateMethod | undefined;
    _mvtOnRefresh: RefreshMethod | undefined;
    _mvtHasUpdate: boolean | undefined;
    _mvtUpdate: SubtreeInfo | undefined;
    _mvtHasRefresh: boolean | undefined;
    _mvtRefresh: SubtreeInfo | undefined;
    onUpdate: UpdateMethod | undefined;
    onRefresh: RefreshMethod | undefined;
}

/**
 * The property descriptors handed to `extensions.mixin`, which copies them onto
 * the prototype with `Object.defineProperties`, accessors intact.
 *
 * The methods are accessors rather than plain fields because assigning one has
 * to invalidate the memoised lists above the container. Without that, giving an
 * already-attached container a method would leave it out of a list built before
 * it carried one - which is exactly the ordering hole `onRender` has.
 */
function createMixinSource(): MvtContainerMixin & ThisType<Container> {
    return {
        _mvtOnUpdate: undefined,
        _mvtOnRefresh: undefined,
        _mvtHasUpdate: undefined,
        _mvtUpdate: undefined,
        _mvtHasRefresh: undefined,
        _mvtRefresh: undefined,

        get onUpdate(): UpdateMethod | undefined {
            return this._mvtOnUpdate;
        },
        set onUpdate(method: UpdateMethod | undefined) {
            if (this._mvtOnUpdate === method) return;
            this._mvtOnUpdate = method;
            invalidateUpdate(this);
        },

        get onRefresh(): RefreshMethod | undefined {
            return this._mvtOnRefresh;
        },
        set onRefresh(method: RefreshMethod | undefined) {
            if (this._mvtOnRefresh === method) return;
            this._mvtOnRefresh = method;
            invalidateRefresh(this);
        },
    };
}

/**
 * Wraps the membership-changing methods on `Container.prototype`.
 *
 * Deliberately absent: `swapChildren`, `sortChildren`, `setChildIndex`, and
 * `addChild` / `addChildAt` when the child is already parented here. Those are
 * pure sibling reorderings, and sibling order carries no guarantee, so they
 * cannot invalidate a list. That exclusion matters - Pixi calls `sortChildren`
 * itself during rendering whenever `sortableChildren` is set.
 *
 * Everything else funnels through these five. `setChildIndex`, `reparentChild`,
 * `reparentChildAt`, `replaceChild`, `removeChildAt` and `removeFromParent` all
 * delegate to `addChildAt` / `removeChild`, and `destroy` delegates to
 * `removeChildren` and `removeFromParent`.
 */
function wrapStructuralMethods(): void {
    const proto = Container.prototype;
    const baseAddChild = proto.addChild;
    const baseAddChildAt = proto.addChildAt;
    const baseRemoveChild = proto.removeChild;
    const baseRemoveChildren = proto.removeChildren;
    const baseDestroy = proto.destroy;

    proto.addChild = function addChild(this: Container, ...children: Container[]): Container {
        if (children.length !== 1) {
            // The base implementation recurses into `this.addChild` per child,
            // so each one is covered by the single-child path below.
            return baseAddChild.apply(this, children);
        }
        const child = children[0];
        // A child already parented here is only being moved to the end of the
        // sibling list. If it had a different parent, the base implementation
        // calls that parent's `removeChild`, which invalidates that side.
        const isReorder = child.parent === this;
        const result = baseAddChild.call(this, child);
        if (!isReorder) invalidate(this);
        return result;
    };

    // Cast: the base signature is generic in the child type, which a wrapper
    // written against `Container` cannot express without losing the `this` type.
    proto.addChildAt = (function addChildAt(this: Container, child: Container, index: number): Container {
        const previousParent = child.parent;
        const result = baseAddChildAt.call(this, child, index);
        if (previousParent === this) return result;
        // Unlike `addChild`, this path splices the child out of its previous
        // parent directly instead of going through `removeChild`, so that side
        // has to be invalidated here.
        if (previousParent) invalidate(previousParent);
        invalidate(this);
        return result;
    }) as typeof proto.addChildAt;

    proto.removeChild = function removeChild(this: Container, ...children: Container[]): Container {
        if (children.length !== 1) {
            return baseRemoveChild.apply(this, children);
        }
        const child = children[0];
        const wasChild = child.parent === this;
        const result = baseRemoveChild.call(this, child);
        if (wasChild) invalidate(this);
        return result;
    };

    proto.removeChildren = function removeChildren(
        this: Container,
        beginIndex?: number,
        endIndex?: number,
    ): Container[] {
        const removed = baseRemoveChildren.call(this, beginIndex, endIndex);
        if (removed.length > 0) invalidate(this);
        return removed;
    };

    proto.destroy = function destroy(this: Container, options?: Parameters<typeof baseDestroy>[0]): void {
        // Clearing the methods is what stops a destroyed container being called
        // again. Detaching alone is not enough: a container driven directly by
        // `updateScene(node)` has no parent to be detached from, so nothing
        // else would ever take it out of its own list. Doing it before the base
        // call means the setters still climb through the ancestors.
        this.onUpdate = undefined;
        this.onRefresh = undefined;
        baseDestroy.call(this, options);
    };
}

/** Invalidates both kinds, which is what every structural change needs. */
function invalidate(node: Container): void {
    invalidateUpdate(node);
    invalidateRefresh(node);
}

/**
 * Climbs to the root clearing the update memo, stopping at the first container
 * already dirty for that kind.
 *
 * The short-circuit relies on a per-kind invariant - a container dirty for kind
 * K implies all its ancestors are dirty for K - which this climb maintains
 * inductively. After the first mutation of a frame the chain above it is
 * already dirty, so every later mutation stops on its first comparison, and a
 * tree nothing ever drives is permanently dirty and costs one comparison per
 * mutation.
 */
function invalidateUpdate(node: Container): void {
    // `Container.parent` is typed `Container | null` by Pixi, one of the few
    // places it hands back `null`, so the climb tests truthiness.
    let cursor: Container | null = node;
    while (cursor) {
        if (cursor._mvtHasUpdate === undefined && cursor._mvtUpdate === undefined) return;
        // Both fields of a kind are cleared together: they are maintained in
        // lockstep and the short-circuit above tests both.
        cursor._mvtHasUpdate = undefined;
        cursor._mvtUpdate = undefined;
        cursor = cursor.parent;
    }
}

/** The refresh half of {@link invalidateUpdate}. */
function invalidateRefresh(node: Container): void {
    let cursor: Container | null = node;
    while (cursor) {
        if (cursor._mvtHasRefresh === undefined && cursor._mvtRefresh === undefined) return;
        cursor._mvtHasRefresh = undefined;
        cursor._mvtRefresh = undefined;
        cursor = cursor.parent;
    }
}
