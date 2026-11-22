import { Container, Texture } from 'pixi.js';
import { attributesOf, type JsxTarget } from '@mvtjs/utils/jsx';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A resource that an element's `owns` attribute may list. It's anything
 * that Pixi frees with `destroy()`, such as a texture, a graphics context or
 * a geometry. A texture is destroyed with its source, since the view that
 * made the texture made its source too. A texture cut from a shared source,
 * such as a frame of a sprite sheet, belongs to the code that made the
 * sheet, so a view doesn't list it.
 */
export interface OwnedResource {
    readonly destroy: () => void;
}

// ---------------------------------------------------------------------------
// JSX target
// ---------------------------------------------------------------------------

/**
 * Pixi's scene graph, as the JSX base needs it. Nodes are `Container`s,
 * whose methods `updateView` and `refreshView` call.
 */
export const pixiTarget: JsxTarget<Container, OwnedResource> = {
    name: '@mvtjs/pixi',

    createGroup: () => new Container(),
    append: (parent, child) => {
        parent.addChild(child);
    },
    replace: (parent, current, next) => {
        parent.addChildAt(next, parent.getChildIndex(current));
        parent.removeChild(current);
    },
    detachTail: (parent, count) => {
        // One call and one invalidation, where removing children one at a time
        // would scan the child list for each: quadratic for a long tail.
        const length = parent.children.length;
        parent.removeChildren(length - count, length);
    },

    // Pixi's setter returns at once when the value is unchanged, so writing it
    // every frame is cheap.
    visible: attributesOf<Container>().everyFrame('visible'),

    destroy: (node) => {
        node.destroy({ children: true });
    },
    // Pixi emits `'destroyed'`, passing the container, after detaching the
    // children and before destroying them.
    onDestroyed: (node, callback) => {
        node.on('destroyed', callback);
    },
    // A sprite can be destroyed safely after its texture is, so this may run
    // before the element's children are destroyed.
    release: (resource) => {
        if (resource instanceof Texture) resource.destroy(true);
        else resource.destroy();
    },

    // A container under Pixi's default event mode (`'passive'`) is not
    // hit-tested, so its handler would never fire. The base calls `listen`
    // before applying the element's other attributes, so an `eventMode`
    // attribute still wins. Set unconditionally rather than only when the
    // mode reads `'passive'`: the getter falls back to Pixi's application-wide
    // default, which an application can change.
    listen: (node, eventName, handler) => {
        node.eventMode = 'static';
        node.on(eventName, handler as (event: unknown) => void);
    },
};
