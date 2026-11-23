/** @jsxImportSource @mvtjs/pixi */

import type { Container, Texture } from 'pixi.js';
import { Scene3DView } from '@mvtjs/pixi-3d';
import { isTouchDevice } from '@mvtjs/site-kit/device';
import type { ArcadeEntry, PlayRect } from '@mvtjs/site-kit/entry-types';
import { type ArcadeControls, describeControl } from '@mvtjs/site-kit/input';
import { ArcadeControlsInputView } from '@mvtjs/site-kit/input/pixi';
import { type LiveEntry, LookDragView, placeScreen, type ScreenPlacement, ShowcaseHudView } from '@mvtjs/site-kit/showcase';
import { FIELD_OF_VIEW, PAINTING_HEIGHT_ABOVE_FLOOR, PAINTING_MAX_HEIGHT, PAINTING_MAX_WIDTH } from '../data';
import type { DemoModel } from '../models';
import { GallerySceneView } from './gallery-scene-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemoViewBindings {
    readonly model: DemoModel;
    /** The arcade controls, which the host passes to the gallery as it starts. */
    readonly controls: ArcadeControls;
    /** The demo on each painting, by the painting's index. */
    readonly entries: readonly ArcadeEntry[];
    /** Each demo's picture, by the painting's index. */
    readonly thumbnails: readonly Texture[];
    /** The demo running on the painting at `index`, if one is. */
    readonly liveAt: (index: number) => LiveEntry | undefined;
    /** Where the page will play the demo on the painting at `index`, in the gallery's pixels, if the gallery runs in the page. */
    readonly playRectAt: (index: number) => PlayRect | undefined;
    /** How wide the gallery's view is, in pixels, as it fits itself to the page. Absent, it's `SCREEN_WIDTH`. Its height is always `SCREEN_HEIGHT`. */
    readonly viewWidth?: () => number;
    /** The page's overlay, where demos that draw with the DOM run over their paintings. A right-drag over one looks round too. Absent outside the page. */
    readonly overlay?: HTMLElement;
}

/** The play area the gallery is designed around, in pixels. It keeps the height, and fits its width to the page. */
export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole gallery. It's a 3D scene, with help drawn over it in 2D. It
 * also wires the controls. Up and down walk, left and right step sideways,
 * a drag across the view looks round, and the primary button steps up to
 * the painting in reach. The painting's demo then plays over the gallery,
 * exactly where the painting was, and the page handles its controls and
 * the way back.
 */
export function DemoView(bindings: DemoViewBindings): Container {
    const { model, controls, entries, thumbnails, liveAt, playRectAt } = bindings;
    const viewWidth = bindings.viewWidth ?? SCREEN_WIDTH;
    const screens: readonly ScreenPlacement[] = model.paintings.map((painting) => placeScreen({
        x: painting.x,
        y: PAINTING_HEIGHT_ABOVE_FLOOR,
        z: painting.z,
        facing: painting.facing,
        playWidth: entries[painting.index].screenWidth,
        playHeight: entries[painting.index].screenHeight,
        maxWidth: PAINTING_MAX_WIDTH,
        maxHeight: PAINTING_MAX_HEIGHT,
    }));
    const press = isTouchDevice() ? 'Tap View' : `Press ${describeControl('primary')}`;
    const viewHints = entries.map((entry) => `${press} to view ${entry.name}`);
    const hint = (): string => (model.paintingInReach === undefined ? '' : viewHints[model.paintingInReach.index]);

    return (
        <container>
            <ArcadeControlsInputView
                controls={controls}
                onXDirectionChanged={(direction) => { model.strafing = direction; }}
                onYDirectionChanged={(direction) => { model.walking = WALKING[direction]; }}
                onPrimaryPressed={model.viewPaintingInReach}
            />
            {/* The 3D scene is built by another JSX runtime, so it's a call, not a tag */}
            <LookDragView
                scene={(
                    <Scene3DView
                        scene={GallerySceneView({ model, entries, thumbnails, screens, liveAt, playRectAt, viewWidth, viewHeight: SCREEN_HEIGHT })}
                        width={viewWidth}
                        height={SCREEN_HEIGHT}
                        background={0xf4f2ec}
                        environment={{ skyColor: 0xf4f2ee, groundColor: 0xd9d4ca }}
                        toneMapping="aces"
                    />
                )}
                width={viewWidth}
                height={SCREEN_HEIGHT}
                radiansPerPixel={LOOK_RADIANS_PER_PIXEL}
                onTurned={model.turnBy}
                onTilted={model.tiltBy}
                overlay={bindings.overlay}
            />
            <ShowcaseHudView width={viewWidth} height={SCREEN_HEIGHT} hint={hint} cornerLine={NO_CORNER_LINE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WALKING = { up: 'forward', none: 'none', down: 'back' } as const;
const NO_CORNER_LINE = (): string => '';
/** A drag the height of the view looks up or down by twice the camera's field of view, so a short drag turns a long way. */
const LOOK_RADIANS_PER_PIXEL = (2 * FIELD_OF_VIEW * Math.PI) / 180 / SCREEN_HEIGHT;
