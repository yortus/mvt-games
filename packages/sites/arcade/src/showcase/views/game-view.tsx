/** @jsxImportSource @mvtjs/pixi */

import { type Container, Texture } from 'pixi.js';
import { Scene3DView } from '@mvtjs/pixi-3d';
import { isTouchDevice } from '@mvtjs/site-kit/device';
import type { ArcadeEntry, PlayRect } from '@mvtjs/site-kit/entry-types';
import { type ArcadeControls, describeControl } from '@mvtjs/site-kit/input';
import { ArcadeControlsInputView } from '@mvtjs/site-kit/input/pixi';
import { type LiveEntry, LookDragView, type ScreenPlacement, ShowcaseHudView } from '@mvtjs/site-kit/showcase';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { FIELD_OF_VIEW } from '../data';
import type { GameModel } from '../models';
import { AudioView } from './audio-view';
import { HallSceneView } from './hall-scene-view';
import { MEADOW_HORIZON, MEADOW_SKY } from './meadow-backdrop-view';
import { MEADOW_GROUND_REACH } from './meadow-ground-view';
import { MeadowSceneView } from './meadow-scene-view';
import { placeCabinetScreen } from './place-cabinet-screen';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: GameModel;
    /** The arcade controls, which the host passes to the game as it starts. */
    readonly controls: ArcadeControls;
    /** The game in each cabinet, by the cabinet's index. */
    readonly entries: readonly ArcadeEntry[];
    /** Each game's picture, by the cabinet's index. */
    readonly thumbnails: readonly Texture[];
    /** The attract game running on the cabinet at `index`, if one is. */
    readonly gameAt: (index: number) => LiveEntry | undefined;
    /** Where the page will play the game on the cabinet at `index`, in the hall's pixels, if the hall runs in the page. */
    readonly playRectAt: (index: number) => PlayRect | undefined;
    /** Whether to draw help over the hall, which a hall on a cabinet's screen leaves off. */
    readonly showsHud: boolean;
    /** Whether to build the meadow outside the last hall, which a hall on a cabinet's screen can't reach, so it leaves it out. */
    readonly hasMeadow: boolean;
    /**
     * How many halls deep this hall is, which the glow round its own cabinet
     * shows. A hall on a cabinet's screen is one deeper than the hall it's in.
     */
    readonly depth: () => number;
    /** The chip the meadow's sounds play on. A hall on a cabinet's screen is silent, and doesn't have one. */
    readonly sfx: SfxChip<'audio90'> | undefined;
    /** How wide the hall's view is, in pixels, as it fits itself to the page. Absent, it's `SCREEN_WIDTH`. Its height is always `SCREEN_HEIGHT`. */
    readonly viewWidth?: () => number;
}

/** The play area the hall is designed around, in pixels. It keeps the height, and fits its width to the page. */
export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole hall. It's a 3D scene, with help drawn over it in 2D. It also
 * wires the controls. Up and down walk, left and right step sideways, a
 * drag across the view looks round, and the primary button steps up to the
 * cabinet in reach. The game on the cabinet then plays over the hall, and
 * the page handles its controls and the way back. The hall's own cabinet
 * is framed to fill the view, so stepping into it is seamless.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, controls, entries, thumbnails, gameAt, showsHud, hasMeadow, depth, sfx } = bindings;
    const viewWidth = bindings.viewWidth ?? SCREEN_WIDTH;
    // The hall's own cabinet's screen fills the view's height, centred, where the hall inside will be. It has the
    // screen's shape, as framing needs, and its place across is written as each step up begins
    const fullView = { x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT };
    const screens: readonly ScreenPlacement[] = model.cabinets.map((cabinet) => placeCabinetScreen({
        cabinet,
        playWidth: entries[cabinet.index].screenWidth,
        playHeight: entries[cabinet.index].screenHeight,
    }));
    const press = isTouchDevice() ? 'Tap Play' : `Press ${describeControl('primary')}`;
    const playHints = entries.map((entry, index) => (index === model.hallCabinet.index ? `${press} to step inside` : `${press} to play ${entry.name}`));
    const insideLine = isTouchDevice() ? 'Hold Play to go back inside' : `Hold ${describeControl('primary')} to go back inside`;
    const hint = (): string => {
        if (model.cabinetInReach !== undefined) return playHints[model.cabinetInReach.index];
        return model.isNearDoor ? DOOR_HINT : '';
    };
    // Written again only when the depth changes, so a frame doesn't build a string
    let lineDepth = 0;
    let depthLine = '';
    const cornerLine = (): string => {
        // Outside, how deep the player went no longer matters, and the line says how to go back inside
        if (model.isOutside) return model.mode === 'walking' ? insideLine : '';
        const nextDepth = model.depth;
        if (nextDepth !== lineDepth) {
            lineDepth = nextDepth;
            depthLine = lineDepth === 0 ? '' : `${lineDepth} ${lineDepth === 1 ? 'hall' : 'halls'} deep`;
        }
        return depthLine;
    };
    const playRectAt = (index: number): PlayRect | undefined => {
        if (index !== model.hallCabinet.index) return bindings.playRectAt(index);
        fullView.x = ((typeof viewWidth === 'function' ? viewWidth() : viewWidth) - SCREEN_WIDTH) / 2;
        return fullView;
    };

    return (
        <container>
            <ArcadeControlsInputView
                controls={controls}
                onXDirectionChanged={(direction) => { model.strafing = direction; }}
                onYDirectionChanged={(direction) => { model.walking = WALKING[direction]; }}
                onPrimaryPressed={() => {
                    // The primary button uses whatever is in reach: a cabinet, or in the last hall, the button
                    model.playCabinetInReach();
                    if (model.isButtonInReach) model.goOutside();
                }}
                // In the meadow, holding the primary button takes the player back inside
                onPrimaryButtonChanged={(pressed) => { model.isHeadingInside = pressed; }}
            />
            {/* The 3D scenes are built by another JSX runtime, so they're calls, not tags */}
            <LookDragView
                scene={(
                    <container>
                        <container visible={() => !model.isOutside}>
                            <Scene3DView
                                scene={HallSceneView({
                                    model,
                                    entries,
                                    thumbnails,
                                    screens,
                                    gameAt,
                                    playRectAt,
                                    depth,
                                    viewWidth,
                                    viewHeight: SCREEN_HEIGHT,
                                    // A click or tap on the button goes outside from anywhere in the last hall
                                    onButtonPressed: model.goOutside,
                                })}
                                width={viewWidth}
                                height={SCREEN_HEIGHT}
                                background={0x0a0812}
                                environment={{ skyColor: 0x3a2f5c, groundColor: 0x120f1c }}
                            />
                        </container>
                        {hasMeadow
                            ? (
                                    <container visible={() => model.isOutside}>
                                        <Scene3DView
                                            scene={MeadowSceneView({ model })}
                                            width={viewWidth}
                                            height={SCREEN_HEIGHT}
                                            background={MEADOW_SKY}
                                            fog={{ type: 'linear', color: MEADOW_HORIZON, near: MEADOW_HAZE_NEAR, far: MEADOW_HAZE_FAR }}
                                        />
                                    </container>
                                )
                            : undefined}
                    </container>
                )}
                width={viewWidth}
                height={SCREEN_HEIGHT}
                radiansPerPixel={LOOK_RADIANS_PER_PIXEL}
                onTurned={model.turnBy}
                onTilted={model.tiltBy}
            />
            <sprite
                texture={Texture.WHITE}
                width={viewWidth}
                height={SCREEN_HEIGHT}
                alpha={() => model.whiteness}
                visible={() => model.whiteness > 0}
            />
            {sfx === undefined ? undefined : <AudioView sfx={sfx} isOutside={() => model.isOutside} />}
            {showsHud ? <ShowcaseHudView width={viewWidth} height={SCREEN_HEIGHT} hint={hint} cornerLine={cornerLine} /> : undefined}
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WALKING = { up: 'forward', none: 'none', down: 'back' } as const;
const DOOR_HINT = 'Walk out through the door to leave this hall';
/**
 * Where the meadow's haze starts, and where it hides everything, in metres.
 * It's a clear day, so the haze is thin and starts a long way off. It
 * measures distance straight ahead, not to the side, so the ground's end, at
 * the edge of a view turned partly down the valley, is nearer by that measure.
 * The haze hides everything well before the ground's end even there.
 */
const MEADOW_HAZE_NEAR = 45;
const MEADOW_HAZE_FAR = MEADOW_GROUND_REACH * 0.6;
/** A drag the height of the view looks up or down by twice the camera's field of view, so a short drag turns a long way. */
const LOOK_RADIANS_PER_PIXEL = (2 * FIELD_OF_VIEW * Math.PI) / 180 / SCREEN_HEIGHT;
