import { Container3D, FlatMaterial, IcosahedronGeometry, Mesh3D } from '@pixi/3d';
import { ownResources, setRefresh } from '@mvtjs/pixi-3d';
import { createRandom } from '@mvtjs/site-kit/random';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MeadowCloudsViewBindings {
    /** Where the player stands, in metres. */
    readonly playerX: () => number;
    readonly playerZ: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Soft white clouds, high over the meadow, each a few flattened puffs.
 * They're laid out over a square of sky that repeats, so wherever the
 * player walks there are clouds overhead, as far as the backdrop. The haze doesn't reach them, so they stay white.
 */
export function MeadowCloudsView({ playerX, playerZ }: MeadowCloudsViewBindings): Container3D {
    const material = new FlatMaterial({ baseColor: 0xffffff, fog: false });
    const random = createRandom({ seed: CLOUD_SEED });
    // Every puff of every cloud uses this one ball, squashed and stretched
    const puff = new IcosahedronGeometry({ radius: 1, detail: 1 });
    const view = ownResources(new Container3D(), [material, puff]);
    const clouds: Container3D[] = [];
    // Where each cloud sits in the repeating square of sky
    const homeX: number[] = [];
    const homeZ: number[] = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
        const cloud = new Container3D();
        const puffs = 2 + random.nextIndex(3);
        for (let p = 0; p < puffs; p++) {
            const mesh = new Mesh3D({ geometry: puff, material });
            const size = random.between(4, 8);
            mesh.scale.set(size * 1.4, size * 0.45, size);
            mesh.position.set((p - (puffs - 1) / 2) * size * 1.3, random.between(-0.5, 0.5), random.between(-2, 2));
            cloud.addChild(mesh);
        }
        cloud.y = random.between(40, 55);
        homeX.push(random.between(0, SKY_TILE));
        homeZ.push(random.between(0, SKY_TILE));
        clouds.push(cloud);
        view.addChild(cloud);
    }

    setRefresh(view, () => {
        const x = playerX();
        const z = playerZ();
        for (let i = 0; i < clouds.length; i++) {
            // The copy of the cloud nearest the player, from all the squares of sky
            clouds[i].x = x + wrap(homeX[i] - x);
            clouds[i].z = z + wrap(homeZ[i] - z);
        }
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CLOUD_COUNT = 30;
const CLOUD_SEED = 4242;
/** The width of the square of sky the clouds repeat over, in metres. */
const SKY_TILE = 320;

/** Brings an offset to between minus and plus half the square of sky. */
function wrap(offset: number): number {
    return offset - Math.round(offset / SKY_TILE) * SKY_TILE;
}
