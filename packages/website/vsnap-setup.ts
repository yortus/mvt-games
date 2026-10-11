import { Object3D } from 'three';
import { destroyElement } from '@mvtjs/html';
import { refreshView } from '@mvtjs/pixi';
import { destroyObject } from '@mvtjs/three';
import { setViewHooks } from 'vsnap';

// Runs in the test page before the site's visual tests. An MVT view writes
// its state to its display objects in its refresh step, so each view is
// refreshed once before its image is taken, as the game loop refreshes once
// a frame. Afterwards it is destroyed the MVT way, which also runs the
// cleanup that its views registered.
setViewHooks({
    prepare: (view) => refreshView(view),
    dispose: (view) => {
        if (view instanceof Element) destroyElement(view);
        else if (view instanceof Object3D) destroyObject(view);
        else view.destroy({ children: true });
    },
});
