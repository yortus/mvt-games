import { Container, Sprite, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { AVENUES, CITY_START_Y, CROSS_STREET_HEIGHT, groundToScreenY } from './city-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TrafficViewBindings {
    /** How far the ship has flown over the city, in world-units. */
    scrollY: () => number;
    /** Stage time in milliseconds. */
    timeMs: () => number;
    /** The area the traffic is drawn over, which places it, so read once. */
    height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Streaks of light running up and down the avenues far below: pale lights
 * heading north, magenta ones heading south.
 *
 * Like the rain, it holds no state. Each streak drives along its lane at its
 * own speed, so where it is on the ground is a function of stage time, and
 * where that is on screen a function of the scroll. The traffic stops when
 * the game does and replays exactly.
 */
export function TrafficView(bindings: TrafficViewBindings): Container {
    const { height } = bindings;
    const span = height + MARGIN * 2;

    const view = new Container();
    view.label = 'traffic';
    const streaks: Sprite[] = [];
    // Each streak's lane, direction (+1 north, -1 south), speed and starting point.
    const laneXs = new Float64Array(STREAK_COUNT);
    const directions = new Float64Array(STREAK_COUNT);
    const speeds = new Float64Array(STREAK_COUNT);
    const phases = new Float64Array(STREAK_COUNT);
    for (let i = 0; i < STREAK_COUNT; i++) {
        const avenue = AVENUES[i % AVENUES.length];
        const isNorthbound = Math.floor(i / AVENUES.length) % 2 === 0;
        directions[i] = isNorthbound ? 1 : -1;
        laneXs[i] = isNorthbound ? avenue.x + avenue.width - 3 : avenue.x + 2;
        speeds[i] = 0.035 + 0.05 * fraction(i * 0.618034);
        phases[i] = fraction(i * 0.414214) * span;
        const streak = new Sprite({ texture: Texture.WHITE, width: 1, height: 3, tint: isNorthbound ? NORTHBOUND : SOUTHBOUND });
        streak.blendMode = 'add';
        streak.x = laneXs[i];
        streaks.push(streak);
        view.addChild(streak);
    }

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const scrollY = bindings.scrollY();
        const timeMs = bindings.timeMs();
        for (let i = 0; i < STREAK_COUNT; i++) {
            const groundY = phases[i] + directions[i] * speeds[i] * timeMs;
            // Wrap round the screen, so each streak is always somewhere near it.
            const y = wrap(groundToScreenY(groundY, scrollY, height) + MARGIN, span) - MARGIN;
            const streak = streaks[i];
            streak.y = y;
            // Only where there are streets: not out over the water.
            streak.visible = scrollY + height - y >= CITY_START_Y + CROSS_STREET_HEIGHT;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const STREAK_COUNT = 36;
const MARGIN = 8;
const NORTHBOUND = 0xd8fbff;
const SOUTHBOUND = 0xff5ce1;

function fraction(value: number): number {
    return value - Math.floor(value);
}

function wrap(value: number, span: number): number {
    return ((value % span) + span) % span;
}
