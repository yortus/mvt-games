/** @jsxImportSource @mvtjs/three/jsx */
import { BoxGeometry, CanvasTexture, type Material, MeshBasicMaterial, type Object3D, PlaneGeometry, SRGBColorSpace } from 'three';
import type { SymbolKind } from '../../data';
import {
    ACCENT_PAINT, BACK_Z, BASE, BODY_BOTTOM, BODY_PAINT, BODY_TOP, BODY_WIDTH, CHROME, DRUM_AXIS_Y, FRONT_Z,
    PANEL_THICKNESS, WINDOW_HEIGHT, WINDOW_WIDTH,
} from './bandit-layout';
import type { MaterialKit } from './material-kit';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CabinetBodyViewBindings {
    readonly kit: MaterialKit;
    /** A symbol's picture, for the fruit decals on the front. */
    readonly canvasFor: (kind: SymbolKind) => HTMLCanvasElement;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The cabinet: a hollow box in glossy paint, so the drums inside show through
 * the glass of the window in its front, on a dark plinth, with chrome trim, a
 * payout tray and fruit decals. Nothing here moves; it has no changing
 * bindings.
 */
export function CabinetBodyView(bindings: CabinetBodyViewBindings): Object3D {
    const { kit, canvasFor } = bindings;
    const height = BODY_TOP - BODY_BOTTOM;
    const depth = FRONT_Z - BACK_Z;
    const middleY = (BODY_BOTTOM + BODY_TOP) / 2;
    const middleZ = (FRONT_Z + BACK_Z) / 2;
    const windowTop = DRUM_AXIS_Y + WINDOW_HEIGHT / 2;
    const windowBottom = DRUM_AXIS_Y - WINDOW_HEIGHT / 2;
    const sideWidth = (BODY_WIDTH - WINDOW_WIDTH) / 2;
    const frontZ = FRONT_Z - FRAME_DEPTH / 2;
    const body = kit.paint(BODY_PAINT);
    const accent = kit.paint(ACCENT_PAINT);
    const chrome = kit.metal(CHROME);
    const base = kit.matte(BASE);

    return (
        <group>
            {/* The plinth, and the box's sides, back, floor and roof */}
            {box(BODY_WIDTH + 0.4, 0.5, depth + 0.4, 0, 0.25, middleZ, base)}
            {box(PANEL_THICKNESS, height, depth, -BODY_WIDTH / 2 + PANEL_THICKNESS / 2, middleY, middleZ, body)}
            {box(PANEL_THICKNESS, height, depth, BODY_WIDTH / 2 - PANEL_THICKNESS / 2, middleY, middleZ, body)}
            {box(BODY_WIDTH, height, PANEL_THICKNESS, 0, middleY, BACK_Z + PANEL_THICKNESS / 2, body)}
            {box(BODY_WIDTH, PANEL_THICKNESS, depth, 0, BODY_BOTTOM + PANEL_THICKNESS / 2, middleZ, body)}
            {box(BODY_WIDTH, PANEL_THICKNESS, depth, 0, BODY_TOP - PANEL_THICKNESS / 2, middleZ, body)}

            {/* The front, round the window */}
            {box(BODY_WIDTH, BODY_TOP - windowTop, FRAME_DEPTH, 0, (BODY_TOP + windowTop) / 2, frontZ, body)}
            {box(BODY_WIDTH, windowBottom - BODY_BOTTOM, FRAME_DEPTH, 0, (BODY_BOTTOM + windowBottom) / 2, frontZ, body)}
            {box(sideWidth, WINDOW_HEIGHT, FRAME_DEPTH, -(WINDOW_WIDTH + sideWidth) / 2, DRUM_AXIS_Y, frontZ, body)}
            {box(sideWidth, WINDOW_HEIGHT, FRAME_DEPTH, (WINDOW_WIDTH + sideWidth) / 2, DRUM_AXIS_Y, frontZ, body)}

            {/* Glass over the window, chrome round it, and bands of the accent colour */}
            <mesh
                geometry={kit.own(new PlaneGeometry(WINDOW_WIDTH, WINDOW_HEIGHT))}
                material={kit.glass()}
                y={DRUM_AXIS_Y}
                z={FRONT_Z - 0.08}
                renderOrder={1}
            />
            {box(WINDOW_WIDTH + 0.24, TRIM, TRIM, 0, windowTop + TRIM / 2 - TRIM_LIP, FRONT_Z, chrome)}
            {box(WINDOW_WIDTH + 0.24, TRIM, TRIM, 0, windowBottom - TRIM / 2 + TRIM_LIP, FRONT_Z, chrome)}
            {box(TRIM, WINDOW_HEIGHT, TRIM, -WINDOW_WIDTH / 2 - TRIM / 2 + TRIM_LIP, DRUM_AXIS_Y, FRONT_Z, chrome)}
            {box(TRIM, WINDOW_HEIGHT, TRIM, WINDOW_WIDTH / 2 + TRIM / 2 - TRIM_LIP, DRUM_AXIS_Y, FRONT_Z, chrome)}
            {box(BODY_WIDTH, 0.28, 0.04, 0, windowTop + 0.75, FRONT_Z + 0.02, accent)}
            {box(BODY_WIDTH, 0.28, 0.04, 0, BODY_BOTTOM + 0.35, FRONT_Z + 0.02, accent)}

            {/* The band carried round the sides, and vents in the back, for anyone who turns it round */}
            {box(0.04, 0.28, depth, -BODY_WIDTH / 2 - 0.02, windowTop + 0.75, middleZ, accent)}
            {box(0.04, 0.28, depth, BODY_WIDTH / 2 + 0.02, windowTop + 0.75, middleZ, accent)}
            {box(BODY_WIDTH, 0.28, 0.04, 0, windowTop + 0.75, BACK_Z - 0.02, accent)}
            {VENT_HEIGHTS.map((y) => box(2.6, 0.14, 0.04, 0, y, BACK_Z - 0.02, base))}

            {/* The payout tray */}
            {box(2.4, 0.36, 0.7, 0, 1.05, FRONT_Z + 0.3, chrome)}
            {box(2.1, 0.12, 0.5, 0, 1.2, FRONT_Z + 0.32, base)}

            {/* Between the lower band and the credit display */}
            {decal('pic3', -1.85, DECAL_Y)}
            {decal('pic2', 1.85, DECAL_Y)}
        </group>
    );

    function box(width: number, boxHeight: number, boxDepth: number, x: number, y: number, z: number, material: Material): Object3D {
        const geometry = kit.own(new BoxGeometry(width, boxHeight, boxDepth));
        return <mesh geometry={geometry} material={material} x={x} y={y} z={z} />;
    }

    /** A fruit from the reels, painted on the front: the same picture the Pixi view and the drums use. */
    function decal(kind: SymbolKind, x: number, y: number): Object3D {
        const texture = kit.own(new CanvasTexture(canvasFor(kind)));
        texture.colorSpace = SRGBColorSpace;
        const material = kit.own(new MeshBasicMaterial({ map: texture, transparent: true }));
        const geometry = kit.own(new PlaneGeometry(DECAL_SIZE, DECAL_SIZE));
        return <mesh geometry={geometry} material={material} x={x} y={y} z={FRONT_Z + 0.01} />;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How deep the front panels round the window are. */
const FRAME_DEPTH = 0.3;
const TRIM = 0.12;
/**
 * How far the chrome trim reaches into the window. Without it, the trim's
 * inner faces lie in the same planes as the frame's round the opening, and
 * the two flicker through each other as the cabinet turns (z-fighting).
 */
const TRIM_LIP = 0.03;
const DECAL_SIZE = 0.7;
const DECAL_Y = 1.38;
const VENT_HEIGHTS = [1.6, 1.95, 2.3, 2.65, 3.0];
