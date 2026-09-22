import type { Container } from 'pixi.js';
import { SKIP_DESCENDANTS, type SubtreeInfo } from './mvt-types';
// Side-effect import: the mixin installs `onUpdate` / `onRefresh` on
// `Container` at module load, which keeps an early method assignment from
// shadowing the accessors.
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
 * mutation, so a static scene pays a list walk and nothing else. A method may
 * return {@link SKIP_DESCENDANTS} to skip its descendants this frame; the
 * container itself has already run, so it can stop skipping next frame. In the
 * update pass that freezes a subtree's state advance, so it is an opt-in for
 * deliberately frozen subtrees rather than a routine tool.
 */
export function updateScene(node: Container, deltaMs: number): void {
    enterPass(activeUpdatePasses, node, 'updateScene');
    try {
        let info = node._mvtUpdate;
        if (info === undefined) {
            if (DEV) assertNoShadowedMethods(node);
            info = buildSubtreeInfo(node, UPDATE);
            node._mvtUpdate = info;
        }
        invokeSubtreeMethods(info, node, UPDATE, deltaMs);
    }
    finally {
        activeUpdatePasses.pop();
    }
}

/**
 * Runs every `onRefresh` in `node`'s subtree, each exactly once, calling a
 * container before any of its descendants. Sibling order is unspecified.
 *
 * The refresh half of {@link updateScene}, with the same memo and ordering.
 * Nothing gates on visibility, so a view is free to set its own `visible`; to
 * skip refreshing its descendants (a hidden or absent subtree) it says so
 * explicitly by returning {@link SKIP_DESCENDANTS}.
 */
export function refreshScene(node: Container): void {
    enterPass(activeRefreshPasses, node, 'refreshScene');
    try {
        let info = node._mvtRefresh;
        if (info === undefined) {
            if (DEV) assertNoShadowedMethods(node);
            info = buildSubtreeInfo(node, REFRESH);
            node._mvtRefresh = info;
        }
        invokeSubtreeMethods(info, node, REFRESH, 0);
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

// Which pass a shared helper is serving. A tiny discriminator keeps
// `collectSubtreeMethods`, the presence cache and the invoke loop as one
// implementation each.
const UPDATE = 0;
const REFRESH = 1;
type Pass = typeof UPDATE | typeof REFRESH;

// Containers with a pass in flight, so a method that re-enters the pass it is
// already inside is caught rather than silently running the list twice. Driving
// a different container from a method is fine and is how a view can refresh
// something it just built.
const activeUpdatePasses: Container[] = [];
const activeRefreshPasses: Container[] = [];

function enterPass(active: Container[], node: Container, name: string): void {
    for (let i = 0; i < active.length; i++) {
        if (active[i] !== node) continue;
        throw new Error(
            `[mvt] ${name}() was called re-entrantly on the same container. `
            + 'A method cannot drive the pass it is already inside; drive a different subtree.',
        );
    }
    active.push(node);
}

/**
 * Walks the memoised list, calling each container's method before its
 * descendants. A method returning {@link SKIP_DESCENDANTS} skips its subtree in
 * one step via the skip table, having already run itself, so it can stop
 * skipping on a later frame.
 */
function invokeSubtreeMethods(info: SubtreeInfo, node: Container, pass: Pass, deltaMs: number): void {
    const list = info.list;
    const skip = info.skip;
    for (let i = 0; i < list.length;) {
        const target = list[i];
        // Detached by a method earlier in this pass: skip its whole subtree,
        // whose internal `parent` links are still intact. The driven root has
        // no parent and is exempt.
        if (!target.parent && target !== node) {
            i = skip[i];
            continue;
        }
        const result = pass === UPDATE ? target.onUpdate?.(deltaMs) : target.onRefresh?.();
        if (result === SKIP_DESCENDANTS) {
            i = skip[i];
            continue;
        }
        i++;
    }
}

/**
 * Builds the memoised {@link SubtreeInfo} for `node`'s subtree: the preorder
 * list of containers carrying the pass's method, and the skip table over it.
 */
function buildSubtreeInfo(node: Container, pass: Pass): SubtreeInfo {
    const list: Container[] = [];
    const ends: number[] = [];
    collectSubtreeMethods(node, pass, list, ends);
    return { list, skip: Int32Array.from(ends) };
}

/**
 * Appends `node`'s subtree in preorder, skipping subtrees that hold no method
 * of this pass, and fills the skip table.
 *
 * `ends` grows in lockstep with `list` and records, for each listed container,
 * the list length once its whole subtree is collected - the index just past its
 * subtree, since preorder makes a subtree contiguous.
 */
function collectSubtreeMethods(node: Container, pass: Pass, out: Container[], ends: number[]): void {
    const method = pass === UPDATE ? node.onUpdate : node.onRefresh;
    let selfIndex = -1;
    if (method !== undefined) {
        selfIndex = out.length;
        out.push(node);
        ends.push(0); // Placeholder, overwritten once this subtree is collected.
    }
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (has(child, pass)) collectSubtreeMethods(child, pass, out, ends);
    }
    if (selfIndex !== -1) ends[selfIndex] = out.length;
}

/**
 * Does this subtree hold any method of this pass?
 *
 * Deliberately visits every child instead of stopping at the first that has
 * one. Visiting them all is what caches them all, and that cache is what makes
 * a later prune a single field read. An early exit would quietly turn every
 * rebuild back into a walk of the whole subtree.
 */
function has(node: Container, pass: Pass): boolean {
    const cached = pass === UPDATE ? node._mvtHasUpdate : node._mvtHasRefresh;
    if (cached !== undefined) return cached;
    if (DEV) assertNoShadowedMethods(node);
    const method = pass === UPDATE ? node.onUpdate : node.onRefresh;
    let found = method !== undefined;
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
        if (has(children[i], pass)) found = true;
    }
    if (pass === UPDATE) node._mvtHasUpdate = found;
    else node._mvtHasRefresh = found;
    return found;
}

/**
 * Dev-only guard against an update or refresh method stored as an own property,
 * which shadows the prototype accessor for the life of that container and
 * silently loses every later invalidation.
 *
 * It cannot happen through assignment any more, now that the mixin installs at
 * module load. It can still happen through `Object.defineProperty`, or a method
 * assigned before a dynamically imported copy of this module has been
 * evaluated.
 */
function assertNoShadowedMethods(node: Container): void {
    if (!Object.hasOwn(node, 'onUpdate') && !Object.hasOwn(node, 'onRefresh')) return;
    throw new Error(
        `[mvt] container ${node.label} carries onUpdate/onRefresh as an own property, `
        + 'which shadows the prototype accessor and loses invalidation. '
        + 'Assign the method instead of defining the property.',
    );
}
