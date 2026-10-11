import type { Container } from 'pixi.js';
import { type Material, Mesh, Object3D } from 'three';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A view that a test can pose: a Pixi container, a three.js object or an HTML element. */
export type AnyView = Container | Object3D | Element;

/**
 * What a project does to its views around each image. A project whose views
 * need work before they are drawn, or care how they are destroyed, sets these
 * in its setup file, with `setViewHooks`.
 */
export interface ViewHooks {
    /**
     * Prepares a view after its pose returns it, and before its image is
     * taken. A view that writes its state to its display objects in a
     * separate step, such as a refresh, does that step here.
     */
    readonly prepare?: (view: AnyView) => void;
    /**
     * Disposes of a view after its image is taken. When it is set, it
     * replaces the package's own disposal: Pixi's `destroy`, three.js's
     * `dispose` on every geometry and material, or removing the element.
     */
    readonly dispose?: (view: AnyView) => void;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Sets the hooks for every test in the page. A project calls it in its
 * setup file, which `setup` in `vsnap.config.ts` names. Each call replaces
 * the hooks that came before it.
 */
export function setViewHooks(next: ViewHooks): void {
    hooks = next;
}

/** Prepares a view with the project's `prepare` hook, if it has one. */
export function prepareView(view: AnyView): void {
    hooks.prepare?.(view);
}

/** Disposes of a view with the project's `dispose` hook, or the package's own disposal if it has none. */
export function disposeView(view: AnyView): void {
    if (hooks.dispose !== undefined) hooks.dispose(view);
    else if (view instanceof Element) view.remove();
    else if (view instanceof Object3D) disposeObject(view);
    else view.destroy({ children: true });
}

/** Removes a three.js object from its parent, and disposes of every geometry and material under it. */
export function disposeObject(root: Object3D): void {
    root.removeFromParent();
    root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        object.geometry.dispose();
        const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
        for (let i = 0; i < materials.length; i++) materials[i].dispose();
    });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The page's hooks. The page runs one project's tests, so one set serves them all. */
let hooks: ViewHooks = {};
