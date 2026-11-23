/** @jsxImportSource @mvtjs/pixi-3d */

import type { Container3D } from '@pixi/3d';
import type { Texture } from 'pixi.js';
import type { ValueOrGetter } from '@mvtjs/pixi-3d';
import type { ArcadeEntry, PlayRect } from '@mvtjs/site-kit/entry-types';
import { type LiveEntry, type ScreenPlacement, WalkerCameraView } from '@mvtjs/site-kit/showcase';
import type { GameModel } from '../models';
import { EYE_HEIGHT, FIELD_OF_VIEW, FINAL_DEPTH } from '../data';
import { ButtonBoxView } from './button-box-view';
import { CabinetView } from './cabinet-view';
import { HallGlowView } from './hall-glow-view';
import { RoomView } from './room-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HallSceneViewBindings {
    readonly model: GameModel;
    /** The game in each cabinet, by the cabinet's index. */
    readonly entries: readonly ArcadeEntry[];
    /** Each game's picture, by the cabinet's index. */
    readonly thumbnails: readonly Texture[];
    /** Where each cabinet's screen is, by the cabinet's index. */
    readonly screens: readonly ScreenPlacement[];
    /** The game running on the cabinet at `index`, if one is. */
    readonly gameAt: (index: number) => LiveEntry | undefined;
    /** Where the page will play the game on the cabinet at `index`, in the view's pixels, if the hall runs in the page. */
    readonly playRectAt: (index: number) => PlayRect | undefined;
    /** How many halls deep this hall is, which the glow round the hall's own cabinet shows. */
    readonly depth: () => number;
    /** The visitor clicked or tapped the button in the last hall. */
    readonly onButtonPressed?: () => void;
    /** The hall's view, in pixels. */
    readonly viewWidth: ValueOrGetter<number>;
    readonly viewHeight: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The hall in 3D, seen through the player's eyes, with a cabinet for each
 * game. The last hall is empty, but for a box with a button.
 */
export function HallSceneView(bindings: HallSceneViewBindings): Container3D {
    const { model, entries, thumbnails, screens, gameAt, playRectAt, depth, viewWidth, viewHeight, onButtonPressed } = bindings;
    return (
        <group>
            <WalkerCameraView
                x={() => model.playerX}
                z={() => model.playerZ}
                heading={() => model.playerHeading}
                pitch={() => model.playerPitch}
                eyeHeight={EYE_HEIGHT}
                screenInPlay={() => (model.cabinetInPlay === undefined ? undefined : screens[model.cabinetInPlay.index])}
                rectInPlay={() => (model.cabinetInPlay === undefined ? undefined : playRectAt(model.cabinetInPlay.index))}
                lean={() => model.lean}
                viewWidth={viewWidth}
                viewHeight={viewHeight}
                fieldOfView={FIELD_OF_VIEW}
                far={CAMERA_FAR}
            />
            <ambientLight color={0x6a5a9a} intensity={0.35} />
            <RoomView isDoorOpen={() => depth() > 0} />
            <group visible={() => depth() < FINAL_DEPTH}>
                <HallGlowView
                    x={model.hallCabinet.x}
                    z={model.hallCabinet.z}
                    depth={depth}
                    leanIn={() => (model.cabinetInPlay === model.hallCabinet ? model.lean : 0)}
                />
                {model.cabinets.map((cabinet) => {
                    const color = CABINET_COLORS[cabinet.index % CABINET_COLORS.length];
                    return (
                        <CabinetView
                            x={cabinet.x}
                            z={cabinet.z}
                            facing={cabinet.facing}
                            name={entries[cabinet.index].name}
                            color={color}
                            cssColor={`#${color.toString(16).padStart(6, '0')}`}
                            thumbnail={thumbnails[cabinet.index]}
                            screenWidth={screens[cabinet.index].width}
                            screenHeight={screens[cabinet.index].height}
                            game={() => gameAt(cabinet.index)}
                        />
                    );
                })}
            </group>
            <group visible={() => depth() >= FINAL_DEPTH}>
                <ButtonBoxView
                    x={model.buttonBox.x}
                    z={model.buttonBox.z}
                    facing={model.buttonBox.facing}
                    isPressed={() => model.mode === 'going-outside'}
                    onPressed={onButtonPressed}
                />
            </group>
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far the player sees, in metres: the length of a hall, and plenty more. */
const CAMERA_FAR = 60;
/** The cabinets' paint, in turn along each wall. */
const CABINET_COLORS: readonly number[] = [0xd8343f, 0x2f6fd6, 0xf0b429, 0x2fa86b, 0x8e44c9, 0xe8732c];
