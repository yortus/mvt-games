import { Container, Sprite, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface RainViewBindings {
    /** Stage time in milliseconds. */
    timeMs: () => number;
    /** The area the rain falls over, which places its streaks, so read once. */
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Rain streaking past, between the city and the ship.
 *
 * The view holds no state: every streak's position is a function of stage
 * time, so the rain needs no update step, stops when the game stops, and
 * falls the same way on every replay.
 */
export function RainView(bindings: RainViewBindings): Container {
    const { width, height } = bindings;
    const span = height + STREAK_LENGTH * 2;

    const view = new Container();
    view.label = 'rain';
    const streaks: Sprite[] = [];
    // Each streak's lane, phase and speed, fixed for the life of the view.
    const laneXs = new Float64Array(STREAK_COUNT);
    const phases = new Float64Array(STREAK_COUNT);
    const speeds = new Float64Array(STREAK_COUNT);
    for (let i = 0; i < STREAK_COUNT; i++) {
        const streak = new Sprite({ texture: Texture.WHITE, width: 1, height: STREAK_LENGTH, tint: STREAK_TINT });
        streak.alpha = 0.18 + 0.12 * ((i * 7) % 3);
        streak.rotation = SLANT;
        streaks.push(streak);
        view.addChild(streak);
        laneXs[i] = fraction(i * 0.618034) * width;
        phases[i] = fraction(i * 0.414214) * span;
        speeds[i] = 0.32 + 0.12 * fraction(i * 0.7548777);
    }

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const timeMs = bindings.timeMs();
        for (let i = 0; i < STREAK_COUNT; i++) {
            const fall = (phases[i] + timeMs * speeds[i]) % span;
            const streak = streaks[i];
            streak.x = laneXs[i] - fall * DRIFT;
            streak.y = fall - STREAK_LENGTH * 2;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const STREAK_COUNT = 56;
const STREAK_LENGTH = 9;
const STREAK_TINT = 0x9fb4ff;
/** The rain slants a little, blown from the right. */
const DRIFT = 0.12;
const SLANT = Math.atan(DRIFT);

function fraction(value: number): number {
    return value - Math.floor(value);
}
