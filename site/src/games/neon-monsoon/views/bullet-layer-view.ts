import { type Container, Particle, ParticleContainer, Rectangle, type Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/**
 * A whole field of bullets, or gems, read by index. Indices are only
 * meaningful within one frame: the model may move a bullet to another index
 * between frames, so the view keeps nothing per index.
 */
export interface BulletLayerViewBindings<K extends string> {
    /** The most bullets there can be. Sizes the view's pool of particles, so read once. */
    capacity: number;
    /**
     * A texture for every kind, read once. All must come from one spritesheet:
     * a particle container draws every particle from one texture source.
     */
    textures: Readonly<Record<K, Texture>>;
    /** The area the bullets fly in, for culling; read once. */
    width: number;
    height: number;
    /** How opaque the whole layer is, read once. */
    alpha?: number;

    count: () => number;
    xAt: (index: number) => number;
    yAt: (index: number) => number;
    kindAt: (index: number) => K;
    /** Direction of travel. Omit for bullets that look the same whichever way they fly. */
    angleAt?: (index: number) => number;
    /** Milliseconds since the bullet appeared. Omit for no spawn flash. */
    ageAt?: (index: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Up to a few thousand bullets in one draw call. Written in plain TypeScript:
 * the whole job is a loop over a pool of particles each frame, and at this
 * count nothing should sit between the loop and Pixi.
 *
 * Particle `i` shows bullet `i`. Each frame it takes every field of the
 * bullet now at that index, texture included, since the bullet there may not
 * be the one that was there last frame.
 */
export function BulletLayerView<K extends string>(bindings: BulletLayerViewBindings<K>): Container {
    const { capacity, textures, count, xAt, yAt, kindAt, angleAt, ageAt } = bindings;

    const view = new ParticleContainer({
        // Everything but colour changes from frame to frame: position, the
        // angle, and the size and texture when a different kind of bullet
        // moves into an index.
        dynamicProperties: { position: true, rotation: true, vertex: true, uvs: true, color: false },
        boundsArea: new Rectangle(0, 0, bindings.width, bindings.height),
    });
    view.label = 'bullet-layer';
    view.alpha = bindings.alpha ?? 1;

    // Every particle the view will ever need, made now so a frame allocates nothing.
    const particles: Particle[] = [];
    const anyTexture = textures[Object.keys(textures)[0] as K];
    for (let i = 0; i < capacity; i++) {
        particles.push(new Particle({ texture: anyTexture, anchorX: 0.5, anchorY: 0.5 }));
    }

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const shown = count();
        showParticles(shown);
        for (let i = 0; i < shown; i++) {
            const particle = particles[i];
            particle.x = xAt(i);
            particle.y = yAt(i);
            particle.texture = textures[kindAt(i)];
            if (angleAt !== undefined) particle.rotation = angleAt(i);
            if (ageAt !== undefined) {
                const scale = spawnScale(ageAt(i));
                particle.scaleX = scale;
                particle.scaleY = scale;
            }
        }
    }

    /** Make the first `shown` particles of the pool the container's children. */
    function showParticles(shown: number): void {
        const children = view.particleChildren;
        if (children.length === shown) return;
        if (shown < children.length) {
            children.length = shown;
        }
        else {
            for (let i = children.length; i < shown; i++) children.push(particles[i]);
        }
        // The container must upload the new particles' static properties.
        view.update();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A new bullet appears larger and shrinks to size, so a pattern announces itself. */
const SPAWN_FLASH_MS = 100;
const SPAWN_FLASH_SCALE = 1.8;

function spawnScale(ageMs: number): number {
    if (ageMs >= SPAWN_FLASH_MS) return 1;
    return SPAWN_FLASH_SCALE - (SPAWN_FLASH_SCALE - 1) * (ageMs / SPAWN_FLASH_MS);
}
