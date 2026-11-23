import { Container3D, FlatMaterial, Mesh3D, PlaneGeometry, PointLight } from '@pixi/3d';
import { Texture } from 'pixi.js';
import { ownResources, setRefresh } from '@mvtjs/pixi-3d';
import { CABINET_DEPTH, HALL_LENGTH } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HallGlowViewBindings {
    /** Where the hall's own cabinet stands, in metres, with its back to the far wall. */
    readonly x: number;
    readonly z: number;
    /** How many halls deep this hall is. */
    readonly depth: () => number;
    /**
     * How far the player has leant in to the hall's own cabinet, from 0 to 1.
     * The glow in front of it fades as they lean in, so they see its screen
     * clearly as they step inside.
     */
    readonly leanIn: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A glow round the hall's own cabinet. A soft halo lights the wall behind it
 * and the floor under it, and a light shines on its front. Two more halos
 * hang just in front of it, always turned to face you, so the glow wraps
 * round the cabinet from wherever you look. Each hall deeper, the glow turns
 * another colour and grows thicker and wider, until the cabinet is lost in
 * it and it fills the end of the room. That's how you see how far in you are.
 */
export function HallGlowView({ x, z, depth, leanIn }: HallGlowViewBindings): Container3D {
    const view = new Container3D();
    const halo = createHaloTexture();
    const material = new FlatMaterial({ baseColorTexture: halo, alphaMode: 'blend', doubleSided: true });
    const outerMaterial = new FlatMaterial({ baseColorTexture: halo, alphaMode: 'blend' });
    const coreMaterial = new FlatMaterial({ baseColorTexture: halo, alphaMode: 'blend' });
    // The halos in front pass through the floor and ceiling as they grow. Drawn over everything, they fade out
    // softly, instead of stopping at a hard line where they meet them, like the light they stand for
    outerMaterial.state.depthTest = false;
    coreMaterial.state.depthTest = false;
    // In front of the cabinet, which faces back down the hall, toward -x
    const frontX = x - CABINET_DEPTH / 2 - FRONT_GAP;
    const outerPlane = new PlaneGeometry({ width: OUTER_HALO_SIZE, height: OUTER_HALO_SIZE });
    const corePlane = new PlaneGeometry({ width: CORE_HALO_SIZE, height: CORE_HALO_SIZE * CORE_STRETCH });
    const wallPlane = new PlaneGeometry({ width: WALL_HALO_WIDTH, height: WALL_HALO_HEIGHT });
    const floorPlane = new PlaneGeometry({ width: FLOOR_HALO_SIZE, height: FLOOR_HALO_SIZE });
    ownResources(view, [halo, material, outerMaterial, coreMaterial, outerPlane, corePlane, wallPlane, floorPlane]);
    const outerHalo = new Mesh3D({ geometry: outerPlane, material: outerMaterial, billboardMode: 'spherical' });
    outerHalo.position.set(frontX, GLOW_HEIGHT, z);
    const coreHalo = new Mesh3D({ geometry: corePlane, material: coreMaterial, billboardMode: 'spherical' });
    // A little nearer than the outer halo, so it draws over it
    coreHalo.position.set(frontX - 0.02, GLOW_HEIGHT, z);
    const wallHalo = new Mesh3D({ geometry: wallPlane, material });
    // Just in front of the far wall, facing back down the hall
    wallHalo.position.set(HALL_LENGTH / 2 - 0.01, WALL_HALO_HEIGHT / 2 - 0.2, z);
    wallHalo.rotation.y = -Math.PI / 2;
    const floorHalo = new Mesh3D({ geometry: floorPlane, material });
    floorHalo.position.set(x, 0.005, z);
    floorHalo.rotation.x = -Math.PI / 2;
    const light = new PointLight();
    light.position.set(x - LIGHT_OFFSET, 1.1, z);
    view.addChild(wallHalo, floorHalo, light, outerHalo, coreHalo);

    // -1, so the first refresh colours it
    let shownDepth = -1;
    let shownLean = -1;
    /** How strong the glow is at this depth, from 0 to 1. */
    let strength = 0;
    setRefresh(view, () => {
        const nextDepth = depth();
        const nextLean = leanIn();
        if (nextDepth !== shownDepth) {
            shownDepth = nextDepth;
            const color = GLOW_COLORS[nextDepth % GLOW_COLORS.length];
            // Stronger each hall deeper, up to a point
            strength = Math.min(1, nextDepth / STRONGEST_DEPTH);
            material.baseColor = color;
            material.alpha = mix(FAINTEST_ALPHA, STRONGEST_ALPHA, strength);
            outerMaterial.baseColor = color;
            // The core is paler, half white at its strongest, like the hot middle of a glow
            coreMaterial.baseColor = mixWithWhite(color, strength * CORE_WHITENESS);
            light.color = color;
            light.intensity = mix(FAINTEST_LIGHT, STRONGEST_LIGHT, strength);
            // Wider, too, filling more of the room. The walls and ceiling hide what spreads past them
            const spread = mix(1, WIDEST_SPREAD, strength);
            outerHalo.scale.set(spread, spread, spread);
            wallHalo.scale.set(spread, spread, spread);
            floorHalo.scale.set(spread, spread, spread);
            const coreSpread = mix(1, WIDEST_CORE_SPREAD, strength);
            coreHalo.scale.set(coreSpread, coreSpread, coreSpread);
            light.range = mix(FAINTEST_LIGHT_RANGE, WIDEST_LIGHT_RANGE, strength);
        }
        else if (nextLean === shownLean) return;
        shownLean = nextLean;
        const clear = 1 - nextLean;
        outerMaterial.alpha = mix(FAINTEST_OUTER_ALPHA, STRONGEST_OUTER_ALPHA, strength) * clear;
        coreMaterial.alpha = mix(FAINTEST_CORE_ALPHA, STRONGEST_CORE_ALPHA, strength) * clear;
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The halos in front of the cabinet: their height above the floor, their gap from its front, and their sizes. */
const GLOW_HEIGHT = 1.15;
const FRONT_GAP = 0.15;
const OUTER_HALO_SIZE = 3.4;
const CORE_HALO_SIZE = 1.5;
/** The core is taller than it is wide, the shape of the cabinet it hides. */
const CORE_STRETCH = 1.6;
const WALL_HALO_WIDTH = 2.8;
const WALL_HALO_HEIGHT = 3;
const FLOOR_HALO_SIZE = 2.6;
/** The light stands this far in front of the cabinet's middle, lighting its front and the floor round it. */
const LIGHT_OFFSET = 0.9;
/** How far the light reaches in the hall itself, and at its strongest. */
const FAINTEST_LIGHT_RANGE = 3.5;
const WIDEST_LIGHT_RANGE = 9;
/** The glow's colour in the hall itself, and in each hall deeper, round and round. */
const GLOW_COLORS: readonly number[] = [0x59c8ff, 0xb46bff, 0xff4fd8, 0xff6a3d, 0xffd23d, 0x4dff8a];
/** How strong each part of the glow is in the hall itself, and at its strongest, and how deep that is. */
const FAINTEST_ALPHA = 0.18;
const STRONGEST_ALPHA = 0.85;
const FAINTEST_OUTER_ALPHA = 0.1;
const STRONGEST_OUTER_ALPHA = 0.75;
const FAINTEST_CORE_ALPHA = 0.06;
const STRONGEST_CORE_ALPHA = 0.95;
const FAINTEST_LIGHT = 0.8;
const STRONGEST_LIGHT = 9;
const STRONGEST_DEPTH = 6;
/** How much bigger the halos grow at the glow's strongest. The wide halo grows more than the core. */
const WIDEST_SPREAD = 2.5;
const WIDEST_CORE_SPREAD = 1.6;
const HALO_TEXTURE_SIZE = 256;

/** How far toward white the core's colour goes, at the glow's strongest. */
const CORE_WHITENESS = 0.5;

function mix(from: number, to: number, amount: number): number {
    return from + (to - from) * amount;
}

/** Returns `color`, moved `amount` of the way to white, from 0 to 1. */
function mixWithWhite(color: number, amount: number): number {
    const red = Math.round(mix((color >> 16) & 0xff, 0xff, amount));
    const green = Math.round(mix((color >> 8) & 0xff, 0xff, amount));
    const blue = Math.round(mix(color & 0xff, 0xff, amount));
    return (red << 16) | (green << 8) | blue;
}

/** A white disc that fades out from its middle, which the material tints. */
function createHaloTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = HALO_TEXTURE_SIZE;
    canvas.height = HALO_TEXTURE_SIZE;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('arcade hall: a glow needs a 2D canvas');
    const middle = HALO_TEXTURE_SIZE / 2;
    const fade = context.createRadialGradient(middle, middle, 0, middle, middle, middle);
    fade.addColorStop(0, 'rgba(255, 255, 255, 1)');
    fade.addColorStop(0.35, 'rgba(255, 255, 255, 0.55)');
    fade.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = fade;
    context.fillRect(0, 0, HALO_TEXTURE_SIZE, HALO_TEXTURE_SIZE);
    return Texture.from(canvas);
}
