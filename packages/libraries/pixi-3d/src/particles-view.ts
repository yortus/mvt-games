import { seededRandom } from '@pixi/3d';
import { ParticleSystem3D, type ParticleSystem3DOptions } from '@pixi/3d/extras';
import { setRefresh, setUpdate } from '@mvtjs/utils';
import type { ValueOrGetter } from '@mvtjs/utils/jsx';
// Registers PixiJS 3D's scene nodes, so `updateView` and `refreshView` walk the particles
import './container3d-mixin';
import { createTickerStandIn } from './ticker-stand-in';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/**
 * How the particles look and move. These are PixiJS 3D's options for a
 * particle system, without the ones that would make it move on its own
 * clock, or draw random numbers from an unseeded source.
 */
export type ParticlesOptions = Omit<ParticleSystem3DOptions, 'autoUpdate' | 'autoPlay' | 'createRandom' | 'onUpdate'>;

export interface ParticlesViewBindings {
    /** How the particles look and move, such as their rate, life, speed, size and colours. Read once. */
    readonly options?: ParticlesOptions;
    /**
     * The seed of the particles' random numbers. Read once. With the same
     * seed and the same steps, they land in the same places, so a visual
     * test's image is the same on every run. Defaults to 1.
     */
    readonly seed?: number | string;
    /** Whether new particles stream out at the options' `emitRate`. Particles already emitted live out their lives either way. Defaults to true. */
    readonly isEmitting?: ValueOrGetter<boolean>;
    /**
     * A count of bursts, such as the model's count of explosions. Each time
     * it rises, the view spawns `burstSize` particles at once. As with a
     * reaction, the view never spawns a burst for the first count that it
     * reads.
     */
    readonly bursts?: () => number;
    /** How many particles each burst spawns. Defaults to 20. */
    readonly burstSize?: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Shows a particle system that moves only by the `deltaMs` that its update
 * step receives. Particles are presentation state. The model never reads
 * them, and they move a little every frame. So this view advances the
 * system in its update step, by the `deltaMs` that `updateView` passes, and
 * never on Pixi's shared ticker. Its refresh step sets whether the system
 * emits, and spawns a burst each time `bursts` rises.
 *
 * Its random numbers come from a seeded source, so the same steps always
 * produce the same particles. It frees its own geometry and material when
 * it's destroyed. The texture in its options belongs to your view, so list
 * it in your view's `owns`.
 */
export function ParticlesView(bindings: ParticlesViewBindings): ParticleSystem3D {
    const { options, isEmitting = true, bursts, burstSize = DEFAULT_BURST_SIZE } = bindings;
    const seed = String(bindings.seed ?? 1);
    const system = new ParticleSystem3D({
        ...options,
        autoUpdate: false,
        autoPlay: false,
        createRandom: () => seededRandom(seed),
    });
    const stepper = createTickerStandIn();
    let isPlaying = false;
    let lastBursts: number | undefined;

    setUpdate(system, (deltaMs) => {
        system.update(stepper.step(deltaMs));
    });
    setRefresh(system, () => {
        const shouldPlay = typeof isEmitting === 'function' ? isEmitting() : isEmitting;
        if (shouldPlay !== isPlaying) {
            isPlaying = shouldPlay;
            if (shouldPlay) system.play();
            else system.stop();
        }
        if (bursts !== undefined) {
            const count = bursts();
            if (lastBursts !== undefined && count > lastBursts) system.spawn(burstSize * (count - lastBursts));
            lastBursts = count;
        }
    });
    return system;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_BURST_SIZE = 20;
