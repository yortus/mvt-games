/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, CubeGeometry, FlatMaterial, Material3D, PlaneGeometry } from '@pixi/3d';
import type { Texture } from 'pixi.js';
import { CABINET_DEPTH, CABINET_HEIGHT, CABINET_WIDTH, SCREEN_HEIGHT_ABOVE_FLOOR, SCREEN_SETBACK, SCREEN_TILT } from '../data';
import { type LiveEntry, LiveScreenView } from '@mvtjs/site-kit/showcase';
import { createMarqueeTexture } from './marquee-texture';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CabinetViewBindings {
    /** Where the cabinet stands, in metres, and the way its screen faces. */
    readonly x: number;
    readonly z: number;
    readonly facing: number;
    /** The game's name, for the marquee. */
    readonly name: string;
    /** The cabinet's colour, as a number and as CSS. */
    readonly color: number;
    readonly cssColor: string;
    /** The game's picture, which the screen shows while the game isn't running. */
    readonly thumbnail: Texture;
    /** The screen's size, in metres, the shape of the game's play area. */
    readonly screenWidth: number;
    readonly screenHeight: number;
    /** The game running on this cabinet, or undefined while it isn't running. */
    readonly game: () => LiveEntry | undefined;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An arcade cabinet, built from boxes: a base, a sloping control panel, a
 * tall upper body with the screen set into it, and a lit marquee along the
 * top. It's built facing +z, then turned to face the aisle. While its game
 * isn't running, the screen shows the game's picture, a little dim, like an
 * attract screen.
 */
export function CabinetView(bindings: CabinetViewBindings): Container3D {
    const { x, z, facing, name, color, cssColor, thumbnail, screenWidth, screenHeight, game } = bindings;
    const paint = new Material3D({ baseColor: color, roughness: 0.45, metallic: 0.1 });
    const black = new Material3D({ baseColor: 0x0b0b10, roughness: 0.6 });
    // The game owns its thumbnail, so the cabinet doesn't free it. The cabinet makes the marquee's picture itself, so it frees that one
    const idleScreen = new FlatMaterial({ baseColorTexture: thumbnail, baseColor: IDLE_TINT });
    const marqueeTexture = createMarqueeTexture({ name, color: cssColor });
    const marquee = new FlatMaterial({ baseColorTexture: marqueeTexture });
    const base = new CubeGeometry({ width: CABINET_WIDTH, height: BASE_HEIGHT, depth: CABINET_DEPTH });
    const panel = new CubeGeometry({ width: CABINET_WIDTH, height: 0.08, depth: PANEL_DEPTH });
    const upper = new CubeGeometry({ width: CABINET_WIDTH, height: UPPER_HEIGHT, depth: UPPER_DEPTH });
    const bezel = new CubeGeometry({ width: CABINET_WIDTH - 0.06, height: BEZEL_HEIGHT, depth: BEZEL_DEPTH });
    const screen = new PlaneGeometry({ width: screenWidth, height: screenHeight, flipV: true });
    const marqueeBox = new CubeGeometry({ width: CABINET_WIDTH, height: MARQUEE_HEIGHT, depth: MARQUEE_DEPTH });
    const marqueePlane = new PlaneGeometry({ width: CABINET_WIDTH - 0.04, height: (CABINET_WIDTH - 0.04) / 4, flipV: true });
    const front = CABINET_DEPTH / 2;
    const screenZ = front - SCREEN_SETBACK;

    return (
        // The cabinet's front faces +z, turned to face the way it faces in the hall
        <group
            owns={[paint, black, idleScreen, marqueeTexture, marquee, base, panel, upper, bezel, screen, marqueeBox, marqueePlane]}
            x={x}
            z={z}
            rotationY={Math.PI / 2 - facing}
        >
            <mesh geometry={base} material={paint} y={BASE_HEIGHT / 2} />
            <mesh
                geometry={panel}
                material={black}
                y={BASE_HEIGHT + 0.03}
                z={front - PANEL_DEPTH / 2}
                rotationX={0.18}
            />
            <mesh
                geometry={upper}
                material={paint}
                y={BASE_HEIGHT + UPPER_HEIGHT / 2}
                z={screenZ - SCREEN_RECESS - UPPER_DEPTH / 2}
            />
            {/* The screen leans back a little, in a black bezel */}
            <group y={SCREEN_HEIGHT_ABOVE_FLOOR} z={screenZ} rotationX={-SCREEN_TILT}>
                <mesh geometry={bezel} material={black} z={-BEZEL_DEPTH / 2 - 0.005} />
                <mesh geometry={screen} material={idleScreen} />
                <LiveScreenView live={game} width={screenWidth} height={screenHeight} />
            </group>
            <mesh
                geometry={marqueeBox}
                material={black}
                y={CABINET_HEIGHT - MARQUEE_HEIGHT / 2}
                z={front - MARQUEE_DEPTH / 2 - 0.06}
            />
            <mesh geometry={marqueePlane} material={marquee} y={CABINET_HEIGHT - MARQUEE_HEIGHT / 2} z={front - 0.059} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BASE_HEIGHT = 1.0;
const PANEL_DEPTH = 0.32;
const MARQUEE_HEIGHT = 0.22;
const MARQUEE_DEPTH = 0.4;
const UPPER_HEIGHT = CABINET_HEIGHT - BASE_HEIGHT - MARQUEE_HEIGHT;
const UPPER_DEPTH = 0.4;
/** The bezel round the screen, its height and how thick it is. */
const BEZEL_HEIGHT = 0.66;
const BEZEL_DEPTH = 0.04;
/**
 * How far the upper body's front stands behind the screen's middle. The
 * screen leans back, so its top edge, and the bezel's, go behind its
 * middle. The body stands clear of the tallest screen's bezel, or it would
 * hide the top of the picture.
 */
const SCREEN_RECESS = Math.sin(SCREEN_TILT) * (BEZEL_HEIGHT / 2) + BEZEL_DEPTH + 0.03;
/** How bright an idle screen is, against a running one. */
const IDLE_TINT = 0xb8b8b8;
