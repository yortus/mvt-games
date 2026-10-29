import { Graphics, Sprite, Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns one of the volley's shots, drawn as the game draws its neon: a
 * white-hot core in layers of dim halo, in pixel-art steps, centred on its
 * position. It is drawn once, then only moved. It glows with additive
 * blending, so it brightens what is under it and never hides a bullet.
 *
 * A `'large'` shot, in flight, glows 13 pixels across. A `'small'` one, in
 * the ring close around the ship, glows 7 across.
 */
export function createShotGlow(colour: number, size: 'large' | 'small'): Graphics {
    const g = new Graphics();
    g.blendMode = 'add';
    if (size === 'large') {
        // The outer halo, a rounded square, then a brighter one inside it
        g.rect(-6, -3, 13, 7).fill({ color: colour, alpha: 0.12 });
        g.rect(-3, -6, 7, 13).fill({ color: colour, alpha: 0.12 });
        g.rect(-4, -4, 9, 9).fill({ color: colour, alpha: 0.2 });
        // The core: a plus of colour round a white centre
        g.rect(-3, -1, 7, 3).fill({ color: colour, alpha: 0.7 });
        g.rect(-1, -3, 3, 7).fill({ color: colour, alpha: 0.7 });
        g.rect(-1, -1, 3, 3).fill(0xffffff);
    }
    else {
        g.rect(-3, -1, 7, 3).fill({ color: colour, alpha: 0.25 });
        g.rect(-1, -3, 3, 7).fill({ color: colour, alpha: 0.25 });
        g.rect(-2, -2, 5, 5).fill({ color: colour, alpha: 0.35 });
        g.rect(-1, -1, 3, 3).fill(0xffffff);
    }
    return g;
}

/**
 * Returns one piece of a shot's streak: a bar that `placeStreak` stretches
 * between two places, glowing like the shot.
 */
export function createStreak(colour: number): Sprite {
    const sprite = new Sprite({ texture: Texture.WHITE, anchor: { x: 0, y: 0.5 } });
    sprite.tint = colour;
    sprite.blendMode = 'add';
    return sprite;
}

/** Stretches `streak` from (x1, y1) to (x2, y2), `thickness` pixels thick. */
export function placeStreak(streak: Sprite, x1: number, y1: number, x2: number, y2: number, thickness: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    streak.position.set(x1, y1);
    streak.rotation = Math.atan2(dy, dx);
    streak.width = Math.sqrt(dx * dx + dy * dy);
    streak.height = thickness;
}
