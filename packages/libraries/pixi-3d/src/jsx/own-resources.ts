import type { Container3D } from '@pixi/3d';
import { type OwnedResource, pixi3dTarget } from './pixi3d-target';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Releases each resource when the node is destroyed. It does the job of the
 * `owns` attribute, for a view written in plain TypeScript. Call it on the
 * node that your view returns, and pass the geometries, materials and
 * textures that the view made. It frees each one as the `owns` attribute
 * does, and returns the node.
 */
export function ownResources<N extends Container3D>(node: N, resources: readonly OwnedResource[]): N {
    const owned = resources.slice();
    node.on('destroyed', () => {
        for (let i = 0; i < owned.length; i++) pixi3dTarget.release(owned[i]);
    });
    return node;
}
