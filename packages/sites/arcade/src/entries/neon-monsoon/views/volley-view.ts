import { Container, Graphics, type Sprite } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { NEON } from './view-constants';
import { createShotGlow, createStreak, placeStreak } from './volley-glow';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface VolleyViewBindings {
    isFlying: () => boolean;
    /** How far the volley has flown, from 0 at release to 1 at the burst. */
    progress: () => number;
    /** Where the ship was when it released the volley. */
    launchX: () => number;
    launchY: () => number;
    /** The ring's angle and radius at the release, which the shots fly out from. Shot `i` starts at `launchAngle + i * 2 * PI / shotCount`. */
    launchAngle: () => number;
    launchRadius: () => number;
    /** How many places the ring has for shots. It sizes the view's sprites, so it is read once. */
    shotCount: number;
    /** Whether shot `i` was left in the ring, and so is flying. */
    hasShotAt: (i: number) => boolean;
    /** Where the target is, which the shots close on. */
    targetX: () => number;
    targetY: () => number;
    /** Where the last burst was, and how long ago, in ms. Infinity if there has not been one. */
    burstX: () => number;
    burstY: () => number;
    msSinceBurst: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The volley in flight, and its burst. The shots leave the ring still
 * turning, and spiral outward into a wide circle a little above the ship,
 * so that none hangs off the bottom of the screen. They hang there for a
 * moment, then speed in on the target, each curving in from its own side.
 *
 * Each shot is a glowing orb, in the game's neon, trailing a solid streak
 * that tapers away behind it. The streak is a chain of bars, each stretched
 * between two places the shot passed a moment apart, so it stays unbroken
 * however fast the shot flies. The burst is a white flash, and a ring
 * spreading out from it. Everything glows with additive blending, so it
 * brightens what is under it and never hides a bullet.
 *
 * Nothing here has state of its own. Each shot's place is worked out afresh
 * every frame from the flight's progress, the ring at the release and the
 * target, and each streak from the places the shot was a moment before.
 */
export function VolleyView(bindings: VolleyViewBindings): Container {
    const { shotCount } = bindings;
    const view = new Container();
    const swarm = new Container();
    const streakLayer = new Container();
    const glowLayer = new Container();
    swarm.addChild(streakLayer, glowLayer);

    const glows: Graphics[] = [];
    const streaks: Sprite[] = [];
    for (let shot = 0; shot < shotCount; shot++) {
        const colour = shot % 2 === 0 ? NEON.cyan : NEON.magenta;
        for (let piece = 0; piece < STREAK_THICKNESSES.length; piece++) {
            const streak = createStreak(colour);
            streak.alpha = STREAK_ALPHA * (1 - piece / STREAK_THICKNESSES.length);
            streaks.push(streak);
            streakLayer.addChild(streak);
        }
        const glow = createShotGlow(colour, 'large');
        glows.push(glow);
        glowLayer.addChild(glow);
    }

    // The flash glows as a shot does: a white core in layers of halo
    const flash = new Graphics()
        .circle(0, 0, FLASH_DRAWN_RADIUS).fill({ color: NEON.cyan, alpha: 0.3 })
        .circle(0, 0, FLASH_DRAWN_RADIUS * 0.65).fill({ color: NEON.cyan, alpha: 0.5 })
        .circle(0, 0, FLASH_DRAWN_RADIUS * 0.35).fill(0xffffff);
    flash.blendMode = 'add';
    const ring = new Graphics().circle(0, 0, RING_DRAWN_RADIUS).stroke({ color: 0xffffff, width: 3 });
    ring.tint = NEON.cyan;
    ring.blendMode = 'add';
    view.addChild(swarm, ring, flash);

    // The flight as of this frame, and two places of a shot, made once and reused
    const flight: Flight = { launchX: 0, launchY: 0, launchAngle: 0, launchRadius: 0, shotCount, targetX: 0, targetY: 0 };
    const place = { x: 0, y: 0 };
    const before = { x: 0, y: 0 };

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        refreshSwarm();
        refreshBurst();
    }

    function refreshSwarm(): void {
        swarm.visible = bindings.isFlying();
        if (!swarm.visible) return;
        flight.launchX = bindings.launchX();
        flight.launchY = bindings.launchY();
        flight.launchAngle = bindings.launchAngle();
        flight.launchRadius = bindings.launchRadius();
        flight.targetX = bindings.targetX();
        flight.targetY = bindings.targetY();
        const progress = bindings.progress();
        const pieces = STREAK_THICKNESSES.length;

        for (let shot = 0; shot < shotCount; shot++) {
            const hasShot = bindings.hasShotAt(shot);
            glows[shot].visible = hasShot;
            for (let piece = 0; piece < pieces; piece++) streaks[shot * pieces + piece].visible = hasShot;
            if (!hasShot) continue;

            placeShot(flight, shot, progress, place);
            glows[shot].position.set(Math.round(place.x), Math.round(place.y));
            // Each piece of the streak runs from where the shot was to where it was a moment before
            for (let piece = 0; piece < pieces; piece++) {
                placeShot(flight, shot, Math.max(0, progress - (piece + 1) * STREAK_STEP), before);
                placeStreak(streaks[shot * pieces + piece], place.x, place.y, before.x, before.y, STREAK_THICKNESSES[piece]);
                place.x = before.x;
                place.y = before.y;
            }
        }
    }

    function refreshBurst(): void {
        const ms = bindings.msSinceBurst();
        flash.visible = ms < FLASH_MS;
        ring.visible = ms < RING_MS;
        if (!ring.visible) return;
        const x = Math.round(bindings.burstX());
        const y = Math.round(bindings.burstY());
        if (flash.visible) {
            const t = ms / FLASH_MS;
            flash.position.set(x, y);
            flash.scale.set((FLASH_START_RADIUS + (FLASH_END_RADIUS - FLASH_START_RADIUS) * easeOutCubic(t)) / FLASH_DRAWN_RADIUS);
            flash.alpha = 1 - t;
        }
        const t = ms / RING_MS;
        ring.position.set(x, y);
        ring.scale.set((RING_START_RADIUS + (RING_END_RADIUS - RING_START_RADIUS) * easeOutCubic(t)) / RING_DRAWN_RADIUS);
        ring.alpha = 1 - t;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What a shot's place depends on, besides which shot it is and how far the flight has come. */
interface Flight {
    launchX: number;
    launchY: number;
    launchAngle: number;
    launchRadius: number;
    shotCount: number;
    targetX: number;
    targetY: number;
}

const TAU = Math.PI * 2;
/** How thick each piece of a shot's streak is, in pixels, from the shot back. */
const STREAK_THICKNESSES: readonly number[] = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
/** How much of the flight each piece of the streak spans. */
const STREAK_STEP = 0.014;
/** How bright the streak is next to the shot. Each piece behind is dimmer. */
const STREAK_ALPHA = 0.9;

/** The flight's three parts, as parts of its progress: out from the ring, hanging, then in to the target. */
const OUT_END = 0.3;
const HANG_END = 0.45;
/** How far from their centre the shots hang, in pixels. */
const HANG_RADIUS = 36;
/**
 * How far above the ship the circle the shots hang in is centred. The ship
 * usually flies near the bottom of the screen, so a circle centred on it
 * would hang half its shots off the screen.
 */
const HANG_LIFT = 20;
/** How far the shots turn on around the ship as they spiral out, in radians. */
const OUT_SPIN = 1.2;
/** How far they drift outward while they hang. */
const HANG_DRIFT = 3;
/** How far past the hanging circle each shot swings before it curves in on the target. */
const CURL = 36;

/** The burst's flash: a white disc that swells and fades. */
const FLASH_MS = 200;
const FLASH_START_RADIUS = 6;
const FLASH_END_RADIUS = 16;
/** The burst's ring, spreading out from the flash. */
const RING_MS = 420;
const RING_START_RADIUS = 4;
const RING_END_RADIUS = 34;
/** The radii the flash and the ring are drawn at, before they are scaled. */
const FLASH_DRAWN_RADIUS = 16;
const RING_DRAWN_RADIUS = 20;

/**
 * Works out where shot number `shot` is, `progress` of the way through the
 * flight, and writes it to `out`. It allocates nothing, since it runs for
 * every shot and every streak, every frame.
 */
function placeShot(flight: Flight, shot: number, progress: number, out: { x: number; y: number }): void {
    const { launchX, launchRadius, targetX, targetY } = flight;
    const centreY = flight.launchY - HANG_LIFT;
    const startAngle = flight.launchAngle + (shot * TAU) / flight.shotCount;
    const hangAngle = startAngle + OUT_SPIN;

    if (progress < OUT_END) {
        // Spiral out: still turning as the ring did, slowing as it spreads
        const t = easeOutCubic(progress / OUT_END);
        const angle = startAngle + OUT_SPIN * t;
        const radius = launchRadius + (HANG_RADIUS - launchRadius) * t;
        out.x = launchX + Math.cos(angle) * radius;
        out.y = flight.launchY - HANG_LIFT * t + Math.sin(angle) * radius;
        return;
    }
    const cos = Math.cos(hangAngle);
    const sin = Math.sin(hangAngle);
    if (progress < HANG_END) {
        const drift = HANG_DRIFT * (progress - OUT_END) / (HANG_END - OUT_END);
        out.x = launchX + cos * (HANG_RADIUS + drift);
        out.y = centreY + sin * (HANG_RADIUS + drift);
        return;
    }

    // Speed in on the target along a curve that first swings on past the circle
    const t = Math.min(1, (progress - HANG_END) / (1 - HANG_END));
    const s = t * t;
    const startX = launchX + cos * (HANG_RADIUS + HANG_DRIFT);
    const startY = centreY + sin * (HANG_RADIUS + HANG_DRIFT);
    const bendX = launchX + cos * (HANG_RADIUS + HANG_DRIFT + CURL);
    const bendY = centreY + sin * (HANG_RADIUS + HANG_DRIFT + CURL);
    const u = 1 - s;
    out.x = u * u * startX + 2 * u * s * bendX + s * s * targetX;
    out.y = u * u * startY + 2 * u * s * bendY + s * s * targetY;
}

function easeOutCubic(t: number): number {
    const u = 1 - t;
    return 1 - u * u * u;
}
