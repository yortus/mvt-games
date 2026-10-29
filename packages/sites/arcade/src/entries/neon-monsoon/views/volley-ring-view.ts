import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { NEON } from './view-constants';
import { createShotGlow } from './volley-glow';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface VolleyRingViewBindings {
    isShown: () => boolean;
    /** The ring's centre: the ship. */
    x: () => number;
    y: () => number;
    radius: () => number;
    /** How far the ring has turned, in radians. Shot `i` is at `angle + i * 2 * PI / shotCount`. */
    angle: () => number;
    /** How many places the ring has for shots. It sizes the view's sprites, so it is read once. */
    shotCount: number;
    hasShotAt: (i: number) => boolean;
    /** Where the ring last stopped a bullet, and how long ago, in ms. Infinity if it has not. */
    hitX: () => number;
    hitY: () => number;
    msSinceHit: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The volley's shots, circling the ship as a shield. Each shot is a small
 * glowing orb, in the game's neon, with a short streak behind it along the
 * ring. They glow with additive blending, so they never hide a bullet. Where a shot stops a
 * bullet, a small spark flashes and fades. Nothing here has state of its
 * own: each shot's place is worked out from the ring's centre, radius and
 * angle, every frame.
 */
export function VolleyRingView(bindings: VolleyRingViewBindings): Container {
    const { shotCount } = bindings;
    const view = new Container();
    const ring = new Container();
    const trailLayer = new Container();
    const glowLayer = new Container();
    ring.addChild(trailLayer, glowLayer);
    const glows: Graphics[] = [];
    const trails: Sprite[] = [];
    for (let shot = 0; shot < shotCount; shot++) {
        const colour = shot % 2 === 0 ? NEON.cyan : NEON.magenta;
        for (let sample = 1; sample <= TRAIL_SAMPLES; sample++) {
            const trail = new Sprite({ texture: Texture.WHITE, width: TRAIL_SIZE, height: TRAIL_SIZE });
            trail.tint = colour;
            trail.blendMode = 'add';
            trail.alpha = 1 - sample / (TRAIL_SAMPLES + 1);
            trails.push(trail);
            trailLayer.addChild(trail);
        }
        const glow = createShotGlow(colour, 'small');
        glows.push(glow);
        glowLayer.addChild(glow);
    }
    const spark = new Graphics().circle(0, 0, SPARK_DRAWN_RADIUS).stroke({ color: 0xffffff, width: 1 });
    view.addChild(ring, spark);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        refreshRing();
        refreshSpark();
    }

    function refreshRing(): void {
        ring.visible = bindings.isShown();
        if (!ring.visible) return;
        const x = bindings.x();
        const y = bindings.y();
        const radius = bindings.radius();
        const angle = bindings.angle();
        let t = 0;
        for (let shot = 0; shot < shotCount; shot++) {
            const hasShot = bindings.hasShotAt(shot);
            const shotAngle = angle + (shot * TAU) / shotCount;
            const glow = glows[shot];
            glow.visible = hasShot;
            if (hasShot) glow.position.set(Math.round(x + Math.cos(shotAngle) * radius), Math.round(y + Math.sin(shotAngle) * radius));
            for (let sample = 1; sample <= TRAIL_SAMPLES; sample++) {
                const trail = trails[t++];
                trail.visible = hasShot;
                if (!hasShot) continue;
                // The streak trails behind the shot, the way the ring turns
                const at = shotAngle - sample * TRAIL_ANGLE;
                const offset = TRAIL_SIZE / 2;
                trail.position.set(Math.round(x + Math.cos(at) * radius - offset), Math.round(y + Math.sin(at) * radius - offset));
            }
        }
    }

    function refreshSpark(): void {
        const ms = bindings.msSinceHit();
        spark.visible = ms < SPARK_MS;
        if (!spark.visible) return;
        const t = ms / SPARK_MS;
        spark.position.set(Math.round(bindings.hitX()), Math.round(bindings.hitY()));
        spark.scale.set((SPARK_START_RADIUS + (SPARK_END_RADIUS - SPARK_START_RADIUS) * t) / SPARK_DRAWN_RADIUS);
        spark.alpha = 1 - t;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const TRAIL_SIZE = 2;
/** Each shot's streak: this many places behind its head, each this many radians back along the ring. */
const TRAIL_SAMPLES = 3;
const TRAIL_ANGLE = 0.14;

const SPARK_MS = 180;
const SPARK_START_RADIUS = 2;
const SPARK_END_RADIUS = 8;
/** The radius the spark is drawn at, before it is scaled. */
const SPARK_DRAWN_RADIUS = 8;
