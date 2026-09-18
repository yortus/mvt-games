import { Container, extensions } from 'pixi.js';
import type { RefreshHook, SceneGraphOwner, UpdateHook } from './mvt-types';

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
             * hidden is stale when it reappears. To stop it, detach or destroy
             * the container.
             */
            onUpdate: UpdateHook | undefined;

            /**
             * Syncs this container's presentation output from model state.
             *
             * Called after every container's `onUpdate` for the tick, and
             * before any of this container's descendants' `onRefresh`.
             * Must be idempotent.
             */
            onRefresh: RefreshHook | undefined;

            /** @internal */ _mvtOnUpdate: UpdateHook | undefined;
            /** @internal */ _mvtOnRefresh: RefreshHook | undefined;
            /** @internal */ _mvtOwner: SceneGraphOwner | undefined;
            /** @internal */ _mvtUpdateSlot: number;
            /** @internal */ _mvtRefreshSlot: number;
        }
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Installs `onUpdate` / `onRefresh` on `Container.prototype` and hooks the
 * structural mutation methods so schedulers learn about tree changes.
 *
 * Idempotent, and called automatically by `createSceneScheduler`.
 *
 * This file and `mvt-application-plugin.ts` are the only two in the spike that
 * use `this`, which the style guide otherwise rules out. A prototype accessor
 * and a wrapped prototype method have no way to reach their instance without
 * it, and Pixi's application plugin contract calls `init` / `destroy` bound to
 * the `Application`. The exemption stops at this boundary: hooks are invoked
 * as plain calls, never with a receiver, so a view's hook is an ordinary
 * closure over its own state like every other view in this repo.
 */
export function installMvtContainerMixin(): void {
    if (installed) return;
    installed = true;
    extensions.mixin(Container, mvtMixin);
    wrapStructuralMethods();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

let installed = false;

interface MvtContainerMixin {
    _mvtOnUpdate: UpdateHook | undefined;
    _mvtOnRefresh: RefreshHook | undefined;
    _mvtOwner: SceneGraphOwner | undefined;
    _mvtUpdateSlot: number;
    _mvtRefreshSlot: number;
    onUpdate: UpdateHook | undefined;
    onRefresh: RefreshHook | undefined;
}

// Accessors rather than plain fields so that assigning a hook to a container
// that is already attached can re-seat it in the call list. Assigning to an
// ancestor whose descendants are already listed would otherwise place the
// ancestor after them - the ordering hole that `onRender` has.
const mvtMixin: MvtContainerMixin & ThisType<Container> = {
    _mvtOnUpdate: undefined,
    _mvtOnRefresh: undefined,
    _mvtOwner: undefined,
    _mvtUpdateSlot: -1,
    _mvtRefreshSlot: -1,

    get onUpdate(): UpdateHook | undefined {
        return this._mvtOnUpdate;
    },
    set onUpdate(hook: UpdateHook | undefined) {
        if (this._mvtOnUpdate === hook) return;
        this._mvtOnUpdate = hook;
        this._mvtOwner?.hookChanged(this);
    },

    get onRefresh(): RefreshHook | undefined {
        return this._mvtOnRefresh;
    },
    set onRefresh(hook: RefreshHook | undefined) {
        if (this._mvtOnRefresh === hook) return;
        this._mvtOnRefresh = hook;
        this._mvtOwner?.hookChanged(this);
    },
};

/**
 * Wraps the membership-changing methods on `Container.prototype`.
 *
 * Deliberately absent: `swapChildren`, `sortChildren`, `setChildIndex`, and
 * `addChild` / `addChildAt` when the child is already parented here. Those are
 * pure sibling reorderings, and sibling order carries no guarantee, so they
 * cannot invalidate a call list. That exclusion matters - `sortChildren` is
 * called by Pixi itself during rendering whenever `sortableChildren` is set.
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
            // so each one is reported by the single-child path below.
            return baseAddChild.apply(this, children);
        }
        const child = children[0];
        // A child already parented here is only being moved to the end of the
        // sibling list. If it had a different parent, the base implementation
        // calls that parent's `removeChild`, which reports the detach for us.
        const isReorder = child.parent === this;
        const result = baseAddChild.call(this, child);
        if (!isReorder) notifyAttach(this, child);
        return result;
    };

    // Cast: the base signature is generic in the child type, which a wrapper
    // written against `Container` cannot express without losing the `this` type.
    proto.addChildAt = (function addChildAt(this: Container, child: Container, index: number): Container {
        const previousParent = child.parent;
        const result = baseAddChildAt.call(this, child, index);
        if (previousParent === this) return result;
        // Unlike `addChild`, this path splices the child out of its previous
        // parent directly instead of going through `removeChild`, so the
        // detach has to be reported here or the container would end up listed
        // twice.
        if (previousParent) notifyDetach(child);
        notifyAttach(this, child);
        return result;
    }) as typeof proto.addChildAt;

    proto.removeChild = function removeChild(this: Container, ...children: Container[]): Container {
        if (children.length !== 1) {
            return baseRemoveChild.apply(this, children);
        }
        const child = children[0];
        const wasChild = child.parent === this;
        const result = baseRemoveChild.call(this, child);
        if (wasChild) notifyDetach(child);
        return result;
    };

    proto.removeChildren = function removeChildren(
        this: Container,
        beginIndex?: number,
        endIndex?: number,
    ): Container[] {
        const removed = baseRemoveChildren.call(this, beginIndex, endIndex);
        for (let i = 0; i < removed.length; i++) {
            notifyDetach(removed[i]);
        }
        return removed;
    };

    proto.destroy = function destroy(this: Container, options?: Parameters<typeof baseDestroy>[0]): void {
        baseDestroy.call(this, options);
        // `destroy` unparents itself via `removeFromParent`, which reports the
        // detach - unless it had no parent, which is the case for a scheduler
        // root. Cover that here so a destroyed root cannot stay in a list.
        if (this._mvtOwner !== undefined) notifyDetach(this);
    };
}

function notifyAttach(parent: Container, child: Container): void {
    const owner = parent._mvtOwner;
    if (owner === undefined) return;
    owner.attachSubtree(child);
}

function notifyDetach(child: Container): void {
    const owner = child._mvtOwner;
    if (owner === undefined) return;
    owner.detachSubtree(child);
}
