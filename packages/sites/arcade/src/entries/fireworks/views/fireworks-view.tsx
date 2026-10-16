/** @jsxImportSource @mvtjs/pixi */

import { Color, type Container, type Graphics } from 'pixi.js';
import { List } from '@mvtjs/pixi';
import { SKY_HEIGHT, SKY_WIDTH, WATER_Y } from '../data';
import type { FireworksModel, Spark } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FireworksViewBindings {
    model: FireworksModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Pixels per sky unit, and the screen's size in pixels. */
export const SCALE = 20;
export const SCREEN_WIDTH = SKY_WIDTH * SCALE;
export const SCREEN_HEIGHT = SKY_HEIGHT * SCALE;

/** The night sky, the sparks and rockets, the city in front of them, and the harbour reflecting the sparks. */
export function FireworksView(bindings: FireworksViewBindings): Container {
    const { model } = bindings;
    return (
        <container>
            <graphics ref={drawSky} />
            <List items={model.sparks}>{(spark) => <SparkView spark={spark} isReflection={false} />}</List>
            <List items={model.rockets}>
                {(rocket) => (
                    <graphics
                        visible={() => rocket().isFlying}
                        x={() => rocket().x * SCALE}
                        y={() => rocket().y * SCALE}
                        ref={(g) => g.rect(-1, 0, 2, 8).fill({ color: 0xffd9a0, alpha: 0.5 }).circle(0, 0, 1.6).fill(0xfff4dc)}
                    />
                )}
            </List>
            <graphics ref={drawCity} />
            <List items={model.sparks}>{(spark) => <SparkView spark={spark} isReflection={true} />}</List>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WATER_TOP = WATER_Y * SCALE;
/** Twelve hues around the colour wheel, for the sparks. */
const HUES = Array.from({ length: 12 }, (_, i) => new Color({ h: i * 30, s: 100, l: 65 }).toNumber());

interface SparkViewBindings {
    spark: () => Spark;
    /** Whether it is the spark's reflection in the harbour: upside down about the water's surface, and dimmer. */
    isReflection: boolean;
}

/** A spark: a white dot with a soft glow and a streak behind it, tinted its hue and fading as its life runs out. */
function SparkView(bindings: SparkViewBindings): Container {
    const { spark, isReflection } = bindings;
    return (
        <graphics
            visible={() => spark().life > 0}
            x={() => spark().x * SCALE}
            y={() => (isReflection ? 2 * WATER_Y - spark().y : spark().y) * SCALE}
            rotation={() => Math.atan2(isReflection ? -spark().ySpeed : spark().ySpeed, spark().xSpeed)}
            alpha={() => spark().life * (isReflection ? 0.3 : 1)}
            tint={() => HUES[Math.floor(spark().hue * HUES.length) % HUES.length]}
            ref={drawSpark}
        />
    );
}

/** A spark heading right: its glow, its streak trailing behind, and its bright head. */
function drawSpark(g: Graphics): void {
    g.circle(0, 0, 3.5).fill({ color: 0xffffff, alpha: 0.2 });
    g.roundRect(-8, -0.75, 8, 1.5, 0.75).fill({ color: 0xffffff, alpha: 0.5 });
    g.circle(0, 0, 1.6).fill(0xffffff);
}

/** A dark sky, glowing faintly toward the horizon, with stars. */
function drawSky(g: Graphics): void {
    g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(0x05071a);
    for (let i = 0; i < 10; i++) g.rect(0, (i * WATER_TOP) / 10, SCREEN_WIDTH, WATER_TOP / 10).fill({ color: 0x2b1d4f, alpha: (i / 10) * 0.7 });
    for (let i = 0; i < 60; i++) g.circle(scramble(i) * SCREEN_WIDTH, scramble(i + 500) * WATER_TOP, 0.6 + scramble(i + 900)).fill({ color: 0xffffff, alpha: 0.5 });
}

/** The city along the harbour, with a few windows lit, and the dark water below it with streaks of light. */
function drawCity(g: Graphics): void {
    for (let i = 0, x = 0; x < SCREEN_WIDTH; i++) {
        const width = 16 + scramble(i) * 24;
        const top = WATER_TOP - 20 - scramble(i + 100) * 50;
        g.rect(x, top, width - 2, WATER_TOP - top).fill(0x0b0f1c);
        for (let wy = top + 5; wy < WATER_TOP - 6; wy += 7) {
            for (let wx = x + 3; wx < x + width - 6; wx += 6) if (scramble(wx * 7 + wy) > 0.75) g.rect(wx, wy, 2, 3).fill(0xffd27a);
        }
        x += width;
    }
    g.rect(0, WATER_TOP, SCREEN_WIDTH, SCREEN_HEIGHT - WATER_TOP).fill(0x060a18);
    for (let i = 0; i < 24; i++) {
        g.rect(scramble(i + 300) * SCREEN_WIDTH, WATER_TOP + 4 + scramble(i + 400) * (SCREEN_HEIGHT - WATER_TOP), 6 + scramble(i) * 18, 1)
            .fill({ color: 0xffd27a, alpha: 0.15 });
    }
}

/** A number from 0 to 1 that looks random but is always the same for the same `n`, so the city is drawn the same every time. */
function scramble(n: number): number {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s);
}
