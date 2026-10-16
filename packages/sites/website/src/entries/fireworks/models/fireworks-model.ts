import { SKY_WIDTH, WATER_Y } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A rocket climbing to where it bursts. Its position is in sky units, down from the top. */
export interface Rocket {
    readonly x: number;
    readonly y: number;
    readonly isFlying: boolean;
}

/** A spark from a burst, falling and fading. */
export interface Spark {
    readonly x: number;
    readonly y: number;
    /** Its speed across and down, in sky units per second. */
    readonly xSpeed: number;
    readonly ySpeed: number;
    /** Its colour, as a hue from 0 to 1. */
    readonly hue: number;
    /** How much of its life is left: 1 at the burst, down to 0, when it is gone. */
    readonly life: number;
}

/**
 * A fireworks show over a harbour. Rockets go up one after another, at
 * random, and each bursts at the top of its climb into a shell of sparks.
 */
export interface FireworksModel {
    /** Every rocket and spark there is room for, in the same arrays all show. Only some are in the sky at once. */
    readonly rockets: readonly Rocket[];
    readonly sparks: readonly Spark[];
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Starts the show, with the first rocket going up at once. */
export function createFireworksModel(): FireworksModel {
    const rockets = Array.from({ length: 8 }, () => ({ x: 0, y: 0, ySpeed: 0, hue: 0, isFlying: false }));
    const sparks = Array.from({ length: 1200 }, () => ({ x: 0, y: 0, xSpeed: 0, ySpeed: 0, hue: 0, life: 0 }));
    let nextRocket = 0;
    let nextSpark = 0;
    let msToNextLaunch = 0;

    return {
        rockets,
        sparks,
        update(deltaMs) {
            const dt = deltaMs / 1000;
            msToNextLaunch -= deltaMs;
            if (msToNextLaunch <= 0) {
                msToNextLaunch += 250 + Math.random() * 600;
                launch();
            }
            for (let i = 0; i < rockets.length; i++) {
                const rocket = rockets[i];
                if (!rocket.isFlying) continue;
                rocket.ySpeed += GRAVITY * dt;
                rocket.y += rocket.ySpeed * dt;
                if (rocket.ySpeed >= 0) burst(rocket);
            }
            const drag = Math.exp(-DRAG * dt);
            for (let i = 0; i < sparks.length; i++) {
                const spark = sparks[i];
                if (spark.life <= 0) continue;
                spark.xSpeed *= drag;
                spark.ySpeed = spark.ySpeed * drag + GRAVITY * dt;
                spark.x += spark.xSpeed * dt;
                spark.y += spark.ySpeed * dt;
                // A spark that reaches the water goes out
                spark.life = spark.y < WATER_Y ? spark.life - dt / SPARK_SECONDS : 0;
            }
        },
    };

    /** Sends the next rocket up from the water, somewhere along the harbour, fast enough to burst high. */
    function launch(): void {
        const rocket = rockets[nextRocket];
        nextRocket = (nextRocket + 1) % rockets.length;
        rocket.x = 2 + Math.random() * (SKY_WIDTH - 4);
        rocket.y = WATER_Y;
        rocket.ySpeed = -(10.5 + Math.random() * 2.5);
        rocket.hue = Math.random();
        rocket.isFlying = true;
    }

    /**
     * Ends the rocket's climb with sparks flying out every way, in two colours
     * close together. Seen from the side, a ball of sparks fills a disc.
     */
    function burst(rocket: (typeof rockets)[number]): void {
        rocket.isFlying = false;
        const size = 3 + Math.random() * 2;
        for (let i = 0; i < SPARKS_PER_BURST; i++) {
            const spark = sparks[nextSpark];
            nextSpark = (nextSpark + 1) % sparks.length;
            const angle = Math.random() * Math.PI * 2;
            const speed = size * (0.35 + 0.65 * Math.sqrt(Math.random()));
            spark.x = rocket.x;
            spark.y = rocket.y;
            spark.xSpeed = Math.cos(angle) * speed;
            spark.ySpeed = Math.sin(angle) * speed;
            spark.hue = i % 2 === 0 ? rocket.hue : (rocket.hue + 0.12) % 1;
            spark.life = 1;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** In sky units per second per second. */
const GRAVITY = 9.8;
/** How quickly the air slows a spark: the share of its speed it loses each second, as a rate. */
const DRAG = 1.3;
const SPARKS_PER_BURST = 90;
/** How long a spark glows. */
const SPARK_SECONDS = 2.2;
