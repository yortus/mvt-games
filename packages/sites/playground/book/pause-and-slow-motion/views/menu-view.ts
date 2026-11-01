import { Container, Graphics, Text } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { ButtonView } from './button-view';
import { ClockView } from './clock-view';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The speeds the player can pick, as shares of real time: 0.5 is half speed. */
const SPEEDS: readonly number[] = [0.5, 1, 2];
/** How long one pulse of the PAUSED sign takes, in ms of real time. */
const PULSE_MS = 1000;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MenuViewBindings {
    readonly isPaused: () => boolean;
    /** How fast the game's time runs, such as 0.5 for half speed. */
    readonly speed: () => number;
    /** Called when the player presses Pause or Resume. */
    readonly onPausePressed: () => void;
    /** Called when the player picks a speed. */
    readonly onSpeedPicked: (speed: number) => void;
    /** The size of the stage, in pixels. The menu's bar runs along its bottom. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The controls for the game's time, a clock of real time, and a PAUSED sign
 * that pulses while the game is paused. The menu runs in real time, so the
 * sign keeps pulsing while the game stands still.
 */
export function MenuView(bindings: MenuViewBindings): Container {
    const { width, height, onSpeedPicked } = bindings;
    const view = new Container();
    const barTop = height - BAR_HEIGHT;

    const bar = new Graphics().rect(0, barTop, width, BAR_HEIGHT).fill(0x141e30);

    const pauseButton = ButtonView({
        label: () => (bindings.isPaused() ? 'Resume' : 'Pause'),
        isSelected: bindings.isPaused,
        width: 100,
        onPressed: bindings.onPausePressed,
    });
    pauseButton.position.set(16, barTop + 13);
    view.addChild(bar, pauseButton);

    for (let i = 0; i < SPEEDS.length; i++) {
        const speed = SPEEDS[i];
        const label = `${speed}x`;
        const speedButton = ButtonView({
            label: () => label,
            isSelected: () => bindings.speed() === speed,
            width: 64,
            onPressed: () => onSpeedPicked(speed),
        });
        speedButton.position.set(140 + i * 74, barTop + 13);
        view.addChild(speedButton);
    }

    const clock = ClockView({ label: 'real time' });
    clock.position.set(width - 170, 12);

    const paused = new Text({
        text: 'PAUSED',
        style: { fontFamily: 'monospace', fontSize: 40, fontWeight: 'bold', fill: 0xffffff },
    });
    paused.anchor.set(0.5, 0.5);
    paused.position.set(width / 2, barTop / 2);
    view.addChild(clock, paused);

    // Presentation state: how far through its pulse the sign is
    let pulseMs = 0;

    setUpdate(view, (deltaMs) => {
        pulseMs = (pulseMs + deltaMs) % PULSE_MS;
    });
    setRefresh(view, () => {
        paused.visible = bindings.isPaused();
        paused.alpha = 0.6 + 0.4 * Math.cos((pulseMs / PULSE_MS) * Math.PI * 2);
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BAR_HEIGHT = 60;
