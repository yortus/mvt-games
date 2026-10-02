import { Container } from 'pixi.js';
import { createScenePasses } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/**
 * The scene passes over Pixi containers: the generic memoised walk
 * (`ScenePasses` in `@mvtjs/utils`), told how to read a container's children
 * and parent. They run whatever a container's `visible`, `renderable` or
 * culling, since presentation state that stops advancing while hidden is
 * stale when it reappears; a view skips its descendants by returning
 * `SKIP_DESCENDANTS`.
 */
const containerScenePasses = createScenePasses<Container>({
    children: (node) => node.children,
    // Pixi types `parent` as `Container | null`, one of the few places it hands
    // back `null`; the walk tests truthiness.
    parent: (node) => node.parent,
    describe,
});

/** The tick API, typed to this renderer's nodes (see `./index.ts`). */
export const { tickScene, setTickMethods } = containerScenePasses;

// Installed at module load rather than lazily on first use, so every container
// carries the scene passes' field defaults before any is given a method or
// walked. Importing this module is the only ordering requirement, and ES
// modules evaluate imports before the importing module's own code.
installMixin();

/**
 * Puts the scene passes' field defaults on `Container.prototype` and wraps the
 * structural methods so the memo fields can be invalidated.
 *
 * The wrapped prototype methods use `this`, which the style guide otherwise
 * rules out: a wrapped prototype method has no way to reach its instance
 * without it. The exemption stops there: the update and refresh methods are
 * invoked as plain calls, so they stay ordinary closures over their own state
 * - the receiver they close over is enough - exactly like a view's own
 * `refresh`.
 */
function installMixin(): void {
    containerScenePasses.installFieldDefaults(Container.prototype);
    wrapStructuralMethods();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

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
    const invalidate = containerScenePasses.invalidate;

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
        if (DEV) warnOfUnrunDestroyedListeners(this, options);
        // Clearing the methods is what stops a destroyed container being called
        // again. Detaching alone is not enough: a container passed to
        // `tickScene` itself has no parent to be detached from, so nothing
        // else would ever take it out of its own list. Doing it before the base
        // call means the setters still climb through the ancestors.
        setTickMethods(this, { update: undefined, refresh: undefined });
        baseDestroy.call(this, options);
    };
}

// Vite replaces `import.meta.env.DEV` at build time. Plain Node - which is how
// the benchmark harness runs - has no `import.meta.env` at all, so it is read
// defensively here rather than assumed.
const DEV = import.meta.env?.DEV === true;

/**
 * Dev-only warning for a destroy that leaves a cleanup unrun. Destroying
 * without `{ children: true }` detaches the children rather than destroying
 * them, so a descendant's `'destroyed'` listener, which is how a view releases
 * a window listener or a shared resource, never runs. That is a leak unless
 * the descendants are about to be reused.
 */
function warnOfUnrunDestroyedListeners(node: Container, options: Parameters<Container['destroy']>[0]): void {
    const destroysChildren = typeof options === 'boolean' ? options : options?.children === true;
    if (destroysChildren || node.destroyed) return;
    const listening = findDestroyedListener(node.children);
    if (listening === undefined) return;
    console.warn(
        `[mvt] container ${describe(node)} was destroyed without { children: true }, so its descendant `
        + `${describe(listening)} was detached, not destroyed, and its 'destroyed' listener did not run. `
        + 'Pass { children: true }, unless the descendants are about to be reused.',
    );
}

/** A container's label for a message. Pixi's default label is `null`, despite its type. */
function describe(node: Container): string {
    return node.label ? `'${node.label}'` : '(unlabelled)';
}

/** The first container in these subtrees with a `'destroyed'` listener, if any. */
function findDestroyedListener(children: Container[]): Container | undefined {
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.listenerCount('destroyed') > 0) return child;
        const found = findDestroyedListener(child.children);
        if (found !== undefined) return found;
    }
    return undefined;
}
