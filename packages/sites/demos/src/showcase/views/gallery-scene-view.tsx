/** @jsxImportSource @mvtjs/pixi-3d */

import type { Container3D } from '@pixi/3d';
import type { Texture } from 'pixi.js';
import type { ValueOrGetter } from '@mvtjs/pixi-3d';
import type { ArcadeEntry, PlayRect } from '@mvtjs/site-kit/entry-types';
import { type LiveEntry, type ScreenPlacement, WalkerCameraView } from '@mvtjs/site-kit/showcase';
import { EYE_HEIGHT, FIELD_OF_VIEW } from '../data';
import type { DemoModel } from '../models';
import { BenchesView } from './benches-view';
import { LanternRoomView } from './lantern-room-view';
import { createPaintingParts } from './painting-parts';
import { PaintingView } from './painting-view';
import { PotsView } from './pots-view';
import { RoomView } from './room-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GallerySceneViewBindings {
    readonly model: DemoModel;
    /** The demo on each painting, by the painting's index. */
    readonly entries: readonly ArcadeEntry[];
    /** Each demo's picture, by the painting's index. */
    readonly thumbnails: readonly Texture[];
    /** Where each painting's picture is, by the painting's index. */
    readonly screens: readonly ScreenPlacement[];
    /** The demo running on the painting at `index`, if one is. */
    readonly liveAt: (index: number) => LiveEntry | undefined;
    /** Where the page will play the demo on the painting at `index`, in the view's pixels, if the gallery runs in the page. */
    readonly playRectAt: (index: number) => PlayRect | undefined;
    /** The gallery's view, in pixels. Its width follows the page, as the gallery fits itself to it. */
    readonly viewWidth: ValueOrGetter<number>;
    readonly viewHeight: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The gallery in 3D, seen through the visitor's eyes, with a painting for each demo, benches and plants, and the hidden lantern room. */
export function GallerySceneView(bindings: GallerySceneViewBindings): Container3D {
    const { model, entries, thumbnails, screens, liveAt, playRectAt, viewWidth, viewHeight } = bindings;
    // Made first, and first in the scene, so it refreshes before the paintings that project through it
    const camera = WalkerCameraView({
        x: () => model.visitorX,
        z: () => model.visitorZ,
        heading: () => model.visitorHeading,
        pitch: () => model.visitorPitch,
        eyeHeight: EYE_HEIGHT,
        screenInPlay: () => (model.paintingInView === undefined ? undefined : screens[model.paintingInView.index]),
        rectInPlay: () => (model.paintingInView === undefined ? undefined : playRectAt(model.paintingInView.index)),
        lean: () => model.lean,
        viewWidth,
        viewHeight,
        fieldOfView: FIELD_OF_VIEW,
        far: CAMERA_FAR,
    });
    const isWalking = (): boolean => model.mode === 'walking';
    const paintingParts = createPaintingParts();
    return (
        <group owns={paintingParts.resources}>
            {camera}
            <ambientLight color={0xffffff} intensity={0.25} />
            <RoomView />
            {model.paintings.map((painting) => (
                <PaintingView
                    x={painting.x}
                    z={painting.z}
                    facing={painting.facing}
                    width={screens[painting.index].width}
                    height={screens[painting.index].height}
                    name={entries[painting.index].name}
                    summary={entries[painting.index].summary}
                    thumbnail={thumbnails[painting.index]}
                    live={() => liveAt(painting.index)}
                    camera={camera}
                    viewWidth={viewWidth}
                    viewHeight={viewHeight}
                    // Still shown through the glide in and out. While the demo plays over the gallery, the painting stands empty
                    isLiveShown={() => model.mode !== 'viewing' && model.isInSight(painting)}
                    isLiveInteractive={() => isWalking() && model.paintingInReach === painting}
                    parts={paintingParts}
                />
            ))}
            <BenchesView spots={model.benches} />
            <PotsView spots={model.pots} />
            <LanternRoomView
                lanterns={model.lanterns}
                visitorX={() => model.visitorX}
                visitorZ={() => model.visitorZ}
                isShown={() => model.isInLanternRoom}
            />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far the visitor sees, in metres: the length of the gallery, and more. */
const CAMERA_FAR = 40;
