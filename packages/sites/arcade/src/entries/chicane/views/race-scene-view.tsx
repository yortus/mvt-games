/** @jsxImportSource @mvtjs/pixi-3d */

import type { Container3D } from '@pixi/3d';
import { GANTRY_SAMPLE } from '../data';
import type { GameModel } from '../models';
import { createCarParts } from './car-parts';
import { CarView } from './car-view';
import { ChaseCameraView } from './chase-camera-view';
import { BoardView } from './board-view';
import { ExplosionView } from './explosion-view';
import { GantryView } from './gantry-view';
import { MissileView } from './missile-view';
import { SceneryView } from './scenery-view';
import { TrackView } from './track-view';
import { WreckageView } from './wreckage-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RaceSceneViewBindings {
    readonly model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The race in 3D. The camera chases your car round the track, through the
 * rivals, under a sun that casts shadows. Missiles fly, and wrecked cars
 * blow up and burn. A car back on the track flashes while it drives through
 * things.
 */
export function RaceSceneView({ model }: RaceSceneViewBindings): Container3D {
    const { car, track, rivals, battle } = model;
    const isCarVisible = (): boolean => !car.isWrecked && Math.floor(car.shieldMs / FLASH_MS) % 2 === 0;
    // One set of car parts for the whole field, with your paint first and then each rival colour's
    const carParts = createCarParts({ colors: [PLAYER_COLOR, ...RIVAL_COLORS] });

    return (
        <group owns={carParts.resources}>
            <ChaseCameraView
                carX={() => car.x}
                carZ={() => car.z}
                carHeading={() => car.heading}
                carSpeed={() => car.speed}
                wrecks={() => car.wrecks}
            />
            <directionalLight
                color={0xfff2dc}
                intensity={2.6}
                castShadow={true}
                shadow={SUN_SHADOW}
                x={-40}
                y={60}
                z={-30}
                lookAt={ORIGIN}
            />
            <TrackView track={track} />
            {/* A little way down the start straight, so it's in view during the countdown. The board is a 2D view, so it's made by a call, not a tag */}
            <GantryView
                sample={track.samples[GANTRY_SAMPLE]}
                trackWidth={track.width}
                board={BoardView({
                    phase: () => model.phase,
                    countdownMs: () => model.countdownMs,
                    lap: () => model.lap,
                    lapTimeMs: () => model.lapTimeMs,
                })}
            />
            <SceneryView track={track} trees={model.trees.trees} />
            <CarView
                x={() => car.x}
                z={() => car.z}
                heading={() => car.heading}
                steeringLock={() => car.steeringLock}
                odometer={() => car.odometer}
                parts={carParts}
                paint={carParts.paints[0]}
                isVisible={isCarVisible}
            />
            {rivals.cars.map((rival, i) => (
                <CarView
                    x={() => rival.x}
                    z={() => rival.z}
                    heading={() => rival.heading}
                    steeringLock={0}
                    odometer={() => rival.odometer}
                    parts={carParts}
                    paint={carParts.paints[1 + (i % RIVAL_COLORS.length)]}
                    isVisible={() => !rival.isWrecked && Math.floor(rival.shieldMs / FLASH_MS) % 2 === 0}
                />
            ))}
            <WreckageView wreckage={battle.wreckage} />
            <MissileView missiles={battle.missiles} />
            <ExplosionView explosions={battle.explosions} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PLAYER_COLOR = 0xe8452c;
/**
 * The sun casts shadows out to 70 metres from the camera. It splits them
 * into two cascades, shadow maps that each cover a band of distance, so the
 * shadows near the camera stay sharp.
 */
const SUN_SHADOW = { cascades: 2, maxDistance: 70 } as const;
const ORIGIN = { x: 0, y: 0, z: 0 };
/** The rivals' paint, colours other than red, so your red car stands out among them. */
const RIVAL_COLORS: readonly number[] = [0x2f7fd8, 0xf2c230, 0x3bb37a, 0xe8e8e8, 0x8a5cd6, 0x1f2a44, 0x24a6b8, 0x9aa3ad];
/** How long each flash lasts, on or off, while a car is back on the track and shielded. */
const FLASH_MS = 90;
