/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import type { PendulumModel, Playback } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PendulumViewBindings {
    model: PendulumModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The screen's size in pixels. */
export const SCREEN_WIDTH = 360;
export const SCREEN_HEIGHT = 420;

/** The pendulum and its fading trail, with buttons to change its speed, step it, and start a new swing. */
export function PendulumView(bindings: PendulumViewBindings): Container {
    const { model } = bindings;
    const arm1 = model.length1 * METRE;
    const arm2 = model.length2 * METRE;
    // Presentation state: the lower bob's latest positions, in pixels from the pivot, in a ring
    const trail = new Float32Array(TRAIL_LENGTH * 2);
    let trailCount = 0;
    let trailNext = 0;
    let trailTime = model.time;
    const trailStyle = { color: TRAIL_COLOR, width: 2, alpha: 1 };
    const isPlayback = (playback: Playback) => () => model.playback === playback;

    return (
        <container onUpdate={recordTrail}>
            <graphics ref={(g) => g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(0x101820)} />
            {/* Everything that swings, from the pivot. Each arm carries its bob at its end. The second hangs from the first, drawn below its bob. */}
            <container x={SCREEN_WIDTH / 2} y={175}>
                <graphics onRefresh={drawTrail} />
                <container rotation={() => -model.angle1}>
                    <graphics y={arm1} rotation={() => model.angle1 - model.angle2} ref={(g) => drawArm(g, arm2, TRAIL_COLOR)} />
                    <graphics ref={(g) => drawArm(g, arm1, 0xf2a541)} />
                </container>
                <graphics ref={(g) => g.circle(0, 0, 4).fill(ARM_COLOR)} />
            </container>
            {/* Step pauses the swing too, so it is lit while paused */}
            <ButtonView column={0} label="Step" isLit={isPlayback('paused')} onPressed={stepOneFrame} />
            <ButtonView column={1} label="Slow" isLit={isPlayback('slow')} onPressed={() => { model.playback = 'slow'; }} />
            <ButtonView column={2} label="Normal" isLit={isPlayback('normal')} onPressed={() => { model.playback = 'normal'; }} />
            <ButtonView column={3} label="Fast" isLit={isPlayback('fast')} onPressed={() => { model.playback = 'fast'; }} />
            <ButtonView column={4} label="Reset" isLit={() => false} onPressed={model.restart} />
        </container>
    );

    /** Pauses the swing if it is running, and moves it on one frame. */
    function stepOneFrame(): void {
        model.playback = 'paused';
        model.step();
    }

    /** Adds the lower bob's position to the trail when the swing has moved, and clears it for a new swing. */
    function recordTrail(): void {
        if (model.time === trailTime) return;
        if (model.time < trailTime) trailCount = 0;
        trailTime = model.time;
        trail[trailNext * 2] = arm1 * Math.sin(model.angle1) + arm2 * Math.sin(model.angle2);
        trail[trailNext * 2 + 1] = arm1 * Math.cos(model.angle1) + arm2 * Math.cos(model.angle2);
        trailNext = (trailNext + 1) % TRAIL_LENGTH;
        trailCount = Math.min(trailCount + 1, TRAIL_LENGTH);
    }

    /** The trail, oldest first, each piece fainter the older it is. */
    function drawTrail(g: Graphics): void {
        g.clear();
        for (let i = 1; i < trailCount; i++) {
            const from = (trailNext - trailCount + i - 1 + TRAIL_LENGTH) % TRAIL_LENGTH;
            const to = (from + 1) % TRAIL_LENGTH;
            trailStyle.alpha = i / trailCount;
            g.moveTo(trail[from * 2], trail[from * 2 + 1]).lineTo(trail[to * 2], trail[to * 2 + 1]).stroke(trailStyle);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Pixels per metre. */
const METRE = 95;
/** How many frames of the lower bob's path the trail keeps. */
const TRAIL_LENGTH = 240;

const ARM_COLOR = 0xc9d1d9;
/** The lower bob's colour, and its trail's. */
const TRAIL_COLOR = 0x5ec8f2;

const BUTTON_WIDTH = 60;
const BUTTON_HEIGHT = 30;
const BUTTON_GAP = 6;
const BUTTON_STYLE = { fill: 0xffffff, fontSize: 12, fontFamily: 'monospace' };
/** Where the row of five buttons starts, so it sits in the middle. */
const BUTTON_LEFT = (SCREEN_WIDTH - 5 * BUTTON_WIDTH - 4 * BUTTON_GAP) / 2;

/** An arm `length` pixels long, hanging straight down from the origin, with a bob of `bobColor` at its end. */
function drawArm(g: Graphics, length: number, bobColor: number): void {
    g.moveTo(0, 0).lineTo(0, length).stroke({ color: ARM_COLOR, width: 3 }).circle(0, length, 9).fill(bobColor);
}

interface ButtonViewBindings {
    /** Its place along the row of buttons, from the left. */
    column: number;
    label: string;
    isLit: () => boolean;
    onPressed: () => void;
}

/** A button along the bottom of the screen, brighter while what it chose is in force. */
function ButtonView(bindings: ButtonViewBindings): Container {
    return (
        <container x={BUTTON_LEFT + bindings.column * (BUTTON_WIDTH + BUTTON_GAP)} y={SCREEN_HEIGHT - BUTTON_HEIGHT - 10} cursor="pointer" onPointerDown={bindings.onPressed}>
            <graphics
                ref={(g) => g.roundRect(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, 6).fill(0xffffff)}
                tint={() => (bindings.isLit() ? 0x2f81f7 : 0x30363d)}
            />
            <text text={bindings.label} x={BUTTON_WIDTH / 2} y={BUTTON_HEIGHT / 2} anchor={0.5} style={BUTTON_STYLE} />
        </container>
    );
}
