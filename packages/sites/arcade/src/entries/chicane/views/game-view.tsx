/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { Scene3DView } from '@mvtjs/pixi-3d';
import { isTouchDevice } from '@mvtjs/site-kit/device';
import { type ArcadeControls, describeControl } from '@mvtjs/site-kit/input';
import { ArcadeControlsInputView } from '@mvtjs/site-kit/input/pixi';
import { OverlayView } from '@mvtjs/site-kit/shared';
import type { GameModel } from '../models';
import { formatTime } from './format-time';
import { HudView } from './hud-view';
import { RaceSceneView } from './race-scene-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: GameModel;
    /** The arcade controls, which the host passes to the game as it starts. */
    readonly controls: ArcadeControls;
}

/** The play area, in pixels. */
export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 400;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole game. The race is a 3D scene, with the HUD drawn over it in 2D,
 * and the result over both once the race is over. It also wires the
 * controls. The car drives itself, so there isn't an accelerator. Left and right
 * steer, the primary button fires, and Down or the secondary button brakes,
 * then reverses. A key steers to full lock. The touch pad steers as far as
 * the thumb is from its middle, so you can hold a gentle line round a bend.
 */
export function GameView({ model, controls }: GameViewBindings): Container {
    const { car, track, rivals } = model;
    const updateBrake = (): void => {
        model.isBraking = controls.yDirection === 'down' || controls.isHeld('secondary');
    };
    const restartHint = isTouchDevice() ? 'Tap to race again' : `Press ${describeControl('restart')} to race again`;
    // The result is written as a lap finishes, not every frame. A new race
    // starts a new list of laps, which also counts as a change
    let resultLaps: readonly number[] | undefined;
    let resultLapCount = 0;
    let resultText = '';
    const result = (): string => {
        const laps = model.lapTimesMs;
        if (laps !== resultLaps || laps.length !== resultLapCount) {
            resultLaps = laps;
            resultLapCount = laps.length;
            resultText = describeResult(model, restartHint);
        }
        return resultText;
    };

    return (
        <container>
            <ArcadeControlsInputView
                controls={controls}
                onXAmountChanged={(amount) => { model.steering = toSteering(amount); }}
                onYDirectionChanged={updateBrake}
                onPrimaryButtonChanged={(isHeld) => { model.isFiring = isHeld; }}
                onSecondaryButtonChanged={updateBrake}
                onRestartPressed={model.startNewRun}
            />
            {/* The 3D scene is built by another JSX runtime, so it's a call, not a tag */}
            <Scene3DView
                scene={RaceSceneView({ model })}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                background={SKY}
                environment={SKY}
                fog={{ color: HAZE, near: 160, far: 520 }}
                toneMapping="aces"
            />
            <HudView
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                phase={() => model.phase}
                countdownMs={() => model.countdownMs}
                raceTimeMs={() => model.raceTimeMs}
                lap={() => model.lap}
                lapTimeMs={() => model.lapTimeMs}
                bestLapMs={() => model.bestLapMs}
                speed={() => car.speed}
                isWrecked={() => car.isWrecked}
                rivalsDestroyed={() => model.rivalsDestroyed}
                isMissileIncoming={() => model.isMissileIncoming}
                track={track}
                carX={() => car.x}
                carZ={() => car.z}
                rivals={rivals.cars}
            />
            <OverlayView
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                isVisible={() => model.phase === 'finished'}
                text={result}
                font="pixel"
                onPressed={model.startNewRun}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The steering for how far left or right is held, from -1 to 1. The touch
 * pad's amount is curved, so small movements near the middle turn the wheel
 * only a little, for fine corrections, and the last of the pad's reach turns
 * it to full lock. A key holds all the way, which stays full lock.
 */
function toSteering(amount: number): number {
    return Math.sign(amount) * Math.abs(amount) ** STEERING_CURVE;
}

/** How sharply the touch pad's steering curves, 1 being straight. */
const STEERING_CURVE = 1.6;

/** A clear blue sky over green ground, which also lights the scene from all round. */
const SKY = { skyColor: 0x8ec5ff, groundColor: 0x4c6b3c };
/** The haze on the horizon, which hides where the ground ends. */
const HAZE = 0xb9d6f2;

function describeResult(model: GameModel, restartHint: string): string {
    const laps = model.lapTimesMs;
    let total = 0;
    let fastest = Infinity;
    for (let i = 0; i < laps.length; i++) {
        total += laps[i];
        fastest = Math.min(fastest, laps[i]);
    }
    const isSessionBest = fastest === model.bestLapMs;
    return `FINISHED\n\nTotal ${formatTime(total)}\nFastest lap ${formatTime(fastest)}${isSessionBest ? '  BEST!' : ''}\nRivals wrecked ${model.rivalsDestroyed}\n\n${restartHint}`;
}
