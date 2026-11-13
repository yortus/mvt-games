// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Starts keeping every shadow root that the page's code attaches with
 * `attachShadow`, closed ones included, for the rest of the page's life.
 * A closed root's host answers `shadowRoot` with `null`, so v-snap couldn't
 * otherwise reach the root to set its text in the blank font, round its font
 * sizes or bring its animations to rest. The roots stay closed to the
 * page's own code. Call it before any of the page's code runs. A root that
 * the HTML parser attaches from a `<template shadowrootmode>` isn't seen,
 * since no `attachShadow` call makes it.
 */
export function watchShadowRoots(): void {
    if (isWatching) return;
    isWatching = true;
    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit): ShadowRoot {
        const root = attachShadow.call(this, init);
        roots.set(this, root);
        return root;
    };
}

/** Returns an element's shadow root, open or closed, if it has one. */
export function findShadowRoot(element: Element): ShadowRoot | undefined {
    return element.shadowRoot ?? roots.get(element);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The shadow roots that `attachShadow` made, by their hosts. */
const roots = new WeakMap<Element, ShadowRoot>();

let isWatching = false;
