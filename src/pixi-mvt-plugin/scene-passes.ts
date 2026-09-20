import type { Container } from 'pixi.js';
// Side-effect import: the mixin installs `onUpdate` / `onRefresh` at module
// load, which is what keeps an early hook assignment from shadowing them.
import './mvt-container-mixin';

// ---------------------------------------------------------------------------
// Passes
// ---------------------------------------------------------------------------

/**
 * Runs every `onUpdate` in `node`'s subtree, each exactly once, calling a
 * container before any of its descendants. Sibling order is unspecified.
 *
 * `node` can be any container, driven at any time: an `Application` stage, a
 * single view under test, or one branch of a scene another caller also drives.
 * Nothing here touches a renderer or a ticker, which is what lets a scene be
 * stepped in a test, fast-forwarded, or stepped to produce a thumbnail.
 *
 * The answer for `node` is memoised on `node` itself and invalidated by tree
 * mutation, so a static scene pays a list walk and nothing else.
 */
export function updateScene(node: Container, deltaMs: number): void {
    enterPass(activeUpdatePasses, node, 'updateScene');
    try {
        let list = node._mvtUpdateList;
        if (list === undefined) {
            if (DEV) assertNoShadowedHooks(node);
            list = [];
            collectUpdate(node, list);
            node._mvtUpdateList = list;
        }
        // The list is a snapshot: a container attached by a hook during this
        // pass is not in it, and runs from the next pass onwards.
        for (let i = 0; i < list.length; i++) {
            const target = list[i];
            // Detached by a hook earlier in this pass. `node` itself is exempt,
            // because a driven root having no parent is the normal case.
            if (!target.parent && target !== node) continue;
            const hook = target.onUpdate;
            if (hook === undefined) continue;
            hook(deltaMs);
        }
    }
    finally {
        activeUpdatePasses.pop();
    }
}

/**
 * Runs every `onRefresh` in `node`'s subtree, each exactly once, calling a
 * container before any of its descendants. Sibling order is unspecified.
 *
 * The refresh half of {@link updateScene}, with the same memo, the same
 * ordering and the same freedom over which container it is driven from.
 */
export function refreshScene(node: Container): void {
    enterPass(activeRefreshPasses, node, 'refreshScene');
    try {
        let list = node._mvtRefreshList;
        if (list === undefined) {
            if (DEV) assertNoShadowedHooks(node);
            list = [];
            collectRefresh(node, list);
            node._mvtRefreshList = list;
        }
        for (let i = 0; i < list.length; i++) {
            const target = list[i];
            if (!target.parent && target !== node) continue;
            const hook = target.onRefresh;
            if (hook === undefined) continue;
            hook();
        }
    }
    finally {
        activeRefreshPasses.pop();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Vite replaces `import.meta.env.DEV` at build time. Plain Node - which is how
// the benchmark harness runs - has no `import.meta.env` at all, so it is read
// defensively here rather than assumed.
const DEV = import.meta.env?.DEV === true;

// Containers with a pass in flight, so a hook that re-enters the pass it is
// already inside is caught rather than silently running the list twice. Driving
// a different container from a hook is fine and is how a view can refresh
// something it just built.
const activeUpdatePasses: Container[] = [];
const activeRefreshPasses: Container[] = [];

function enterPass(active: Container[], node: Container, name: string): void {
    for (let i = 0; i < active.length; i++) {
        if (active[i] !== node) continue;
        throw new Error(
            `[mvt] ${name}() was called re-entrantly on the same container. `
            + 'A hook cannot drive the pass it is already inside; drive a different subtree.',
        );
    }
    active.push(node);
}

/**
 * Appends `node`'s subtree in preorder, skipping subtrees that hold no hook of
 * this kind.
 */
function collectUpdate(node: Container, out: Container[]): void {
    if (node.onUpdate !== undefined) out.push(node);
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (hasUpdate(child)) collectUpdate(child, out);
    }
}

/**
 * Does this subtree hold any `onUpdate`?
 *
 * Deliberately visits every child instead of stopping at the first hooked one.
 * Visiting them all is what caches them all, and that cache is what makes a
 * later prune a single field read. An early exit would quietly turn every
 * rebuild back into a walk of the whole subtree.
 */
function hasUpdate(node: Container): boolean {
    const cached = node._mvtHasUpdate;
    if (cached !== undefined) return cached;
    if (DEV) assertNoShadowedHooks(node);
    let found = node.onUpdate !== undefined;
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
        if (hasUpdate(children[i])) found = true;
    }
    node._mvtHasUpdate = found;
    return found;
}

/** The refresh half of {@link collectUpdate}. */
function collectRefresh(node: Container, out: Container[]): void {
    if (node.onRefresh !== undefined) out.push(node);
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (hasRefresh(child)) collectRefresh(child, out);
    }
}

/** The refresh half of {@link hasUpdate}. */
function hasRefresh(node: Container): boolean {
    const cached = node._mvtHasRefresh;
    if (cached !== undefined) return cached;
    if (DEV) assertNoShadowedHooks(node);
    let found = node.onRefresh !== undefined;
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
        if (hasRefresh(children[i])) found = true;
    }
    node._mvtHasRefresh = found;
    return found;
}

/**
 * Dev-only guard against a hook stored as an own property, which shadows the
 * prototype accessor for the life of that container and silently loses every
 * later invalidation.
 *
 * It cannot happen through assignment any more, now that the mixin installs at
 * module load. It can still happen through `Object.defineProperty`, or a hook
 * assigned before a dynamically imported plugin has been evaluated.
 */
function assertNoShadowedHooks(node: Container): void {
    if (!Object.hasOwn(node, 'onUpdate') && !Object.hasOwn(node, 'onRefresh')) return;
    throw new Error(
        `[mvt] container ${node.label} carries onUpdate/onRefresh as an own property, `
        + 'which shadows the prototype accessor and loses invalidation. '
        + 'Assign the hook instead of defining the property.',
    );
}
