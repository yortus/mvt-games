import { Container, Sprite, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The width and height of each spark, in pixels. */
const SPARK_SIZE = 4;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SparksViewBindings {
    /** How many sparks are alight. */
    readonly count: () => number;
    readonly xAt: (index: number) => number;
    readonly yAt: (index: number) => number;
    /** How much of its life a spark has burned, from 0 to 1. */
    readonly burnedAt: (index: number) => number;
    /** Whether to keep a pool of sprites, made once and reused, rather than make new ones every tick. */
    readonly usePool: boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A sprite for each spark, which turns from yellow to red, and fades, as
 * the spark burns. It has two refresh steps that draw the same thing: one
 * makes a new sprite for every spark, every tick, and throws the old ones
 * away, and the other reuses a pool of sprites.
 */
export function SparksView(bindings: SparksViewBindings): Container {
    const { count, xAt, yAt, burnedAt, usePool } = bindings;
    const view = new Container();

    // The pool: one sprite for each spark there has ever been at once
    const pool: Sprite[] = [];

    setRefresh(view, usePool ? refreshFromPool : refreshWithNewSprites);
    return view;

    function refreshWithNewSprites(): void {
        // Throws away last tick's sprites, and makes a new one for every spark
        const old = view.removeChildren();
        for (let i = 0; i < old.length; i++) old[i].destroy();
        const n = count();
        for (let i = 0; i < n; i++) {
            const sprite = makeSpark();
            placeSpark(sprite, i);
            view.addChild(sprite);
        }
    }

    function refreshFromPool(): void {
        const n = count();
        // The pool grows only when there are more sparks than ever before
        while (pool.length < n) {
            const sprite = makeSpark();
            pool.push(sprite);
            view.addChild(sprite);
        }
        for (let i = 0; i < pool.length; i++) {
            const sprite = pool[i];
            sprite.visible = i < n;
            if (i < n) placeSpark(sprite, i);
        }
    }

    function placeSpark(sprite: Sprite, index: number): void {
        const burned = burnedAt(index);
        sprite.position.set(xAt(index), yAt(index));
        sprite.alpha = 1 - burned;
        // Yellow, through orange, to red: less green as it burns
        sprite.tint = 0xff0000 | (Math.round(0xee * (1 - burned)) << 8) | 0x22;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function makeSpark(): Sprite {
    const sprite = new Sprite(Texture.WHITE);
    sprite.anchor.set(0.5);
    sprite.width = SPARK_SIZE;
    sprite.height = SPARK_SIZE;
    return sprite;
}
