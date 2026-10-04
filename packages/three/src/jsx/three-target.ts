import { Group, type Object3D } from 'three';
import { attributesOf, type JsxTarget } from '@mvtjs/utils/jsx';
import { destroyObject, onDestroyed } from '../object3d-mixin';

// ---------------------------------------------------------------------------
// JSX target
// ---------------------------------------------------------------------------

/**
 * three.js's scene graph, as the JSX base needs it. Nodes are `Object3D`s,
 * whose methods `updateView` and `refreshView` call.
 */
export const threeTarget: JsxTarget<Object3D> = {
    name: '@mvtjs/three',

    createGroup: () => new Group(),
    append: (parent, child) => {
        parent.add(child);
    },
    replace: (parent, current, next) => {
        // three has no `addChildAt`. Child order does not change how three
        // draws, but `<List>` keeps slot i as child i, and detaches its tail
        // from the end, so `next` takes `current`'s place in `children`. The
        // `add` has already cleared the cached method lists; moving a child
        // among its siblings needs no more.
        const index = parent.children.indexOf(current);
        parent.remove(current);
        parent.add(next);
        const children = parent.children;
        children.pop();
        children.splice(index, 0, next);
    },
    detachTail: (parent, count) => {
        // three's `remove` finds each child by scanning from the front, so a
        // long tail costs time in proportion to its length times the list's.
        for (let i = 0; i < count; i++) parent.remove(parent.children[parent.children.length - 1]);
    },

    // three's renderer does not descend into an invisible object, which
    // agrees with skipping its subtree; writing the flag is a plain assignment.
    visible: attributesOf<Object3D>().everyFrame('visible'),

    destroy: destroyObject,
    onDestroyed,

    // `Object3D` is an `EventDispatcher`. Pointer events reach it from the
    // pointer picker, which raycasts and dispatches them.
    listen: (node, eventName, handler) => {
        node.addEventListener(eventName as never, handler as never);
    },
};
