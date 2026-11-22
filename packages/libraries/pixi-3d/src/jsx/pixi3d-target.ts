import { Container3D, Geometry3D } from '@pixi/3d';
import { Texture } from 'pixi.js';
import { attributesOf, type JsxTarget } from '@mvtjs/utils/jsx';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A resource that an element's `owns` attribute may list. It can be
 * anything freed with `destroy()`, such as a geometry, a material or a
 * texture. A geometry is destroyed with its own buffers, and a texture with
 * its source, since the view that owns one made those too. Destroying a
 * material doesn't destroy its textures, so a view that made them lists
 * them as well.
 */
export interface OwnedResource {
    readonly destroy: () => void;
}

// ---------------------------------------------------------------------------
// JSX target
// ---------------------------------------------------------------------------

/**
 * PixiJS 3D's scene graph, as the JSX base needs it. Nodes are `Container3D`s,
 * whose methods `updateView` and `refreshView` call. Its tree methods follow
 * Pixi's, so this matches @mvtjs/pixi's target closely.
 */
export const pixi3dTarget: JsxTarget<Container3D, OwnedResource> = {
    name: '@mvtjs/pixi-3d',

    createGroup: () => new Container3D(),
    append: (parent, child) => {
        parent.addChild(child);
    },
    replace: (parent, current, next) => {
        parent.addChildAt(next, parent.getChildIndex(current));
        parent.removeChild(current);
    },
    detachTail: (parent, count) => {
        // One call and one invalidation, where removing children one at a time
        // would scan the child list for each.
        const length = parent.children.length;
        parent.removeChildren(length - count, length);
    },

    // Hiding a node hides its subtree from the renderer, which matches
    // skipping its subtree's methods.
    visible: attributesOf<Container3D>().everyFrame('visible'),

    destroy: (node) => {
        node.destroy({ children: true });
    },
    // PixiJS 3D emits `'destroyed'` after detaching the children and before
    // destroying them, as Pixi does.
    onDestroyed: (node, callback) => {
        node.on('destroyed', callback);
    },
    // A geometry or material clears its list of meshes as it's destroyed, so
    // the element's children can still be destroyed safely afterwards
    // (checked against PixiJS 3D 0.1.0).
    release: (resource) => {
        if (resource instanceof Geometry3D || resource instanceof Texture) resource.destroy(true);
        else resource.destroy();
    },

    // A node isn't hit-tested until it has an event mode, so its handler
    // would never fire. The base calls `listen` before the element's other
    // attributes, so an `eventMode` attribute still wins.
    listen: (node, eventName, handler) => {
        node.eventMode = 'static';
        node.on(eventName as never, handler as never);
    },
};
