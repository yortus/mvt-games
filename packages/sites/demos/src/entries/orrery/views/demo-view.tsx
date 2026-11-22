/** @jsxImportSource @mvtjs/pixi */

import { type Container, Rectangle } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { Scene3DView } from '@mvtjs/pixi-3d';
import { listenToDragZoom } from '@mvtjs/site-kit/input/pixi';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { MAX_TURNS_PER_SECOND } from '../data';
import type { DemoModel } from '../models';
import { AudioView } from './audio-view';
import { OrreryView } from './orrery-view';
import { SPEED_SLIDER_HEIGHT, SPEED_SLIDER_WIDTH, SpeedSliderView } from './speed-slider-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DemoViewBindings {
    readonly model: DemoModel;
    /** The chip the orrery's ticking plays on. */
    readonly sfx: SfxChip<'audio80'>;
}

/** The play area, in pixels. */
export const SCREEN_WIDTH = 480;
export const SCREEN_HEIGHT = 360;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The orrery in 3D, with the home world's day count over it, and a slider
 * for the motor's speed, both drawn in 2D. The 3D scene is a `View3D`, a
 * Pixi container like any other, so the 2D after it draws on top.
 *
 * A drag anywhere off the slider turns the camera round the orrery, either
 * way, and up or down. A pinch, or the wheel, moves it closer or further.
 * Where the camera stands is the view's own presentation state. The model
 * doesn't store where the visitor looks from, so this view keeps it, and
 * passes it down to the scene's camera.
 */
export function DemoView({ model, sfx }: DemoViewBindings): Container {
    const dayText = createComputed({ watch: () => Math.floor(model.days), compute: (day) => `Day ${day}` });
    const rateText = createComputed({ watch: () => Math.round(model.daysPerSecond), compute: formatRate });
    // Where the camera stands, round the point it looks at
    let cameraYaw = 0;
    let cameraTilt = STARTING_TILT;
    let cameraDistance = STARTING_DISTANCE;
    let isTurning = false;

    return (
        <container>
            {/* The 3D scene is built by another JSX runtime, so it's a call, not a tag */}
            <Scene3DView
                scene={OrreryView({
                    model,
                    cameraYaw: () => cameraYaw,
                    cameraTilt: () => cameraTilt,
                    cameraDistance: () => cameraDistance,
                })}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                background={{ skyColor: 0x1c2036, groundColor: 0x07080d }}
                // A faint fill from the room, so the brass has something to reflect, and the worlds' night sides aren't black
                environment={{ skyColor: 0x4a5070, groundColor: 0x20140c }}
            />
            {/* Receives every gesture that misses the slider, which is drawn over it */}
            <container
                ref={listenToCameraGestures}
                hitArea={new Rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)}
                cursor={() => (isTurning ? 'grabbing' : 'grab')}
            />
            <text text={dayText} x={12} y={10} style={LABEL_STYLE} />
            <container x={(SCREEN_WIDTH - SPEED_SLIDER_WIDTH) / 2} y={SCREEN_HEIGHT - SPEED_SLIDER_HEIGHT - 10}>
                <SpeedSliderView
                    speed={() => model.motorTurnsPerSecond}
                    maxSpeed={MAX_TURNS_PER_SECOND}
                    label={rateText}
                    onSpeedChosen={(speed) => {
                        model.motorTurnsPerSecond = speed;
                    }}
                />
            </container>
            <AudioView sfx={sfx} teethPassed={() => model.teethPassed} />
        </container>
    );

    function listenToCameraGestures(target: Container): void {
        listenToDragZoom({
            target,
            onGestureBegan: () => {
                isTurning = true;
            },
            onGestureEnded: () => {
                isTurning = false;
            },
            // Dragging right swings the orrery's near side right, so the camera moves round to the left
            onDragged: (deltaX, deltaY) => {
                cameraYaw -= deltaX * RADIANS_PER_PIXEL;
                cameraTilt = clamp(cameraTilt + deltaY * RADIANS_PER_PIXEL, MIN_TILT, MAX_TILT);
            },
            onZoomed: (factor) => {
                cameraDistance = clamp(cameraDistance / factor, MIN_DISTANCE, MAX_DISTANCE);
            },
        });
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The camera's tilt and distance to begin with, in front and looking down, so the gears show under the arms. */
const STARTING_TILT = 0.44;
const STARTING_DISTANCE = 5;

/** The lowest tilt, nearly level with the plinth, and the highest, nearly straight down. */
const MIN_TILT = 0.05;
const MAX_TILT = 1.45;

/** The closest the camera comes, near enough to see the teeth mesh, and the furthest it goes. */
const MIN_DISTANCE = 1.6;
const MAX_DISTANCE = 10;

/** How far a drag turns the camera, in radians for each pixel. A drag across the screen turns it half way round. */
const RADIANS_PER_PIXEL = Math.PI / SCREEN_WIDTH;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** Describes how fast the home world's days pass. */
function formatRate(daysPerSecond: number): string {
    if (daysPerSecond === 0) return 'Stopped';
    return Math.abs(daysPerSecond) === 1 ? `${daysPerSecond} day a second` : `${daysPerSecond} days a second`;
}

const LABEL_STYLE = { fill: 0xe8d8a8, fontFamily: 'monospace', fontSize: 16 };
