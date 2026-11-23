/** @jsxImportSource @mvtjs/pixi-3d */

import { type Camera3D, type Container3D, CubeGeometry, FlatMaterial, PlaneGeometry } from '@pixi/3d';
import type { Texture } from 'pixi.js';
import type { ValueOrGetter } from '@mvtjs/pixi-3d';
import { LiveElementView, type LiveEntry, LiveScreenView } from '@mvtjs/site-kit/showcase';
import { PAINTING_HEIGHT_ABOVE_FLOOR, PAINTING_STANDOFF, ROOM_HEIGHT } from '../data';
import { createLabelTexture } from './label-texture';
import { LABEL_WIDTH, type PaintingParts } from './painting-parts';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PaintingViewBindings {
    /** Where the painting's picture is, in metres, and the way it faces. */
    readonly x: number;
    readonly z: number;
    readonly facing: number;
    /** The picture's size, in metres, the shape of the demo's play area. */
    readonly width: number;
    readonly height: number;
    /** The demo's name and summary, for the label beside it. */
    readonly name: string;
    readonly summary: string;
    /** The demo's picture, which the painting shows while the demo isn't running. */
    readonly thumbnail: Texture;
    /** The demo running on this painting, or undefined while it isn't running. */
    readonly live: () => LiveEntry | undefined;
    /**
     * For a demo that draws with the DOM, which runs over the gallery's
     * canvas, the camera and the view's size, to lay it over the painting,
     * and whether to show it.
     */
    readonly camera: Camera3D;
    readonly viewWidth: ValueOrGetter<number>;
    readonly viewHeight: number;
    readonly isLiveShown: () => boolean;
    /** Whether the demo receives pointer events now, so the visitor can use it without stepping up. */
    readonly isLiveInteractive: () => boolean;
    /** What every painting has the same of, which the gallery's scene owns. */
    readonly parts: PaintingParts;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A painting on the gallery's wall. The demo's picture sits in a wide white
 * mat, in a thin black frame. While the demo runs, it plays over its
 * picture. A small label beside it shows the demo's name, and a spotlight
 * on the ceiling lights it. It's built facing +z, then turned to face the
 * room.
 */
export function PaintingView(bindings: PaintingViewBindings): Container3D {
    const { x, z, facing, width, height, name, summary, thumbnail, live, camera, viewWidth, viewHeight, isLiveShown, isLiveInteractive, parts } = bindings;
    const { mat, frame, labelPlane } = parts;
    const matWidth = width + 2 * MAT_BORDER;
    const matHeight = height + 2 * MAT_BORDER;
    const sideBar = new CubeGeometry({ width: FRAME_SIZE, height: matHeight + 2 * FRAME_SIZE, depth: PAINTING_STANDOFF });
    const topBar = new CubeGeometry({ width: matWidth, height: FRAME_SIZE, depth: PAINTING_STANDOFF });
    const matPlane = new PlaneGeometry({ width: matWidth, height: matHeight });
    const picturePlane = new PlaneGeometry({ width, height, flipV: true });
    // The caller owns the thumbnail, so the painting frees only the material that it makes for it
    const picture = new FlatMaterial({ baseColorTexture: thumbnail });
    // The frame's back is against the wall, and its front is level with the picture
    const frameZ = -PAINTING_STANDOFF / 2;
    const labelTexture = createLabelTexture({ name, summary });
    const label = new FlatMaterial({ baseColorTexture: labelTexture });

    return (
        // The painting's front faces +z, turned to face the way it faces in the gallery
        <group
            x={x}
            y={PAINTING_HEIGHT_ABOVE_FLOOR}
            z={z}
            rotationY={Math.PI / 2 - facing}
            owns={[sideBar, topBar, matPlane, picturePlane, picture, labelTexture, label]}
        >
            <mesh geometry={matPlane} material={mat} z={-0.004} />
            <mesh geometry={sideBar} material={frame} x={-(matWidth + FRAME_SIZE) / 2} z={frameZ} />
            <mesh geometry={sideBar} material={frame} x={(matWidth + FRAME_SIZE) / 2} z={frameZ} />
            <mesh geometry={topBar} material={frame} y={(matHeight + FRAME_SIZE) / 2} z={frameZ} />
            <mesh geometry={topBar} material={frame} y={-(matHeight + FRAME_SIZE) / 2} z={frameZ} />
            {/* The picture is unlit, so it shows its true colours, as the demo would on a screen */}
            <mesh geometry={picturePlane} material={picture} />
            <LiveScreenView live={live} width={width} height={height} isInteractive={isLiveInteractive} />
            <LiveElementView
                live={live}
                camera={camera}
                width={width}
                height={height}
                viewWidth={viewWidth}
                viewHeight={viewHeight}
                isShown={isLiveShown}
                isInteractive={isLiveInteractive}
            />
            <mesh
                geometry={labelPlane}
                material={label}
                x={matWidth / 2 + FRAME_SIZE + LABEL_GAP + LABEL_WIDTH / 2}
                y={LABEL_DROP}
                z={-PAINTING_STANDOFF + 0.004}
            />
            {/* A spotlight hangs from the ceiling, out from the wall. It aims at the painting's middle, so a soft pool of light falls round the painting */}
            <spotLight
                color={0xfff1dc}
                intensity={LIGHT_INTENSITY}
                range={5}
                coneAngle={28}
                penumbra={0.6}
                x={0}
                y={LIGHT_HEIGHT}
                z={LIGHT_OUT}
                lookAt={PICTURE_MIDDLE}
            />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How wide the white mat is round the picture, and the frame round the mat, in metres. */
const MAT_BORDER = 0.12;
const FRAME_SIZE = 0.035;
/** The label's gap from the frame, and how far below the painting's middle it hangs, in metres. */
const LABEL_GAP = 0.18;
const LABEL_DROP = -0.25;
/** The spotlight, near the ceiling, out from the wall, and how bright it is. */
const LIGHT_HEIGHT = ROOM_HEIGHT - 0.15 - PAINTING_HEIGHT_ABOVE_FLOOR;
const LIGHT_OUT = 1.4;
const LIGHT_INTENSITY = 70;
/** The middle of the picture, in the painting's own space, which the spotlight aims at. */
const PICTURE_MIDDLE = { x: 0, y: 0, z: 0 };
