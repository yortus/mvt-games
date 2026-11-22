/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import type { RivalCar, Track } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MinimapViewBindings {
    readonly track: Track;
    /** The map's size, in pixels. The track is fitted inside it, keeping its shape. */
    readonly size: number;
    /** Where the car is on the ground, in metres. */
    readonly carX: () => number;
    readonly carZ: () => number;
    /** The rivals, read once, each shown as a small dot while it's on the track. */
    readonly rivals: readonly RivalCar[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The track from above, with a dot for your car and smaller ones for the
 * rivals. North is up, so +z runs down the map, as the camera's world does
 * from above.
 */
export function MinimapView(bindings: MinimapViewBindings): Container {
    const { track, size, carX, carZ, rivals } = bindings;
    const fit = fitTrack(track, size);
    const toMapX = (x: number): number => (x - fit.minX) * fit.scale + fit.offsetX;
    const toMapY = (z: number): number => (z - fit.minZ) * fit.scale + fit.offsetY;

    const drawTrack = (g: Graphics): void => {
        const { samples } = track;
        g.moveTo(toMapX(samples[0].x), toMapY(samples[0].z));
        for (let i = 1; i < samples.length; i++) g.lineTo(toMapX(samples[i].x), toMapY(samples[i].z));
        g.closePath().stroke({ width: 4, color: 0x111318, alpha: 0.7, join: 'round' });
        g.moveTo(toMapX(samples[0].x), toMapY(samples[0].z));
        for (let i = 1; i < samples.length; i++) g.lineTo(toMapX(samples[i].x), toMapY(samples[i].z));
        g.closePath().stroke({ width: 2, color: 0xe8e8e2, join: 'round' });
    };

    return (
        <container>
            <graphics ref={drawTrack} />
            {rivals.map((rival) => (
                <graphics
                    ref={(g) => g.circle(0, 0, 2).fill(0x8ec5ff)}
                    visible={() => !rival.isWrecked}
                    x={() => toMapX(rival.x)}
                    y={() => toMapY(rival.z)}
                />
            ))}
            <graphics ref={(g) => g.circle(0, 0, 3.5).fill(0xe8452c).stroke({ width: 1, color: 0xffffff })} x={() => toMapX(carX())} y={() => toMapY(carZ())} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How to scale and place the track so it fits in a square of `size` pixels, centred. */
function fitTrack(track: Track, size: number) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < track.samples.length; i++) {
        minX = Math.min(minX, track.samples[i].x);
        maxX = Math.max(maxX, track.samples[i].x);
        minZ = Math.min(minZ, track.samples[i].z);
        maxZ = Math.max(maxZ, track.samples[i].z);
    }
    const inner = size - MAP_PADDING * 2;
    const scale = inner / Math.max(maxX - minX, maxZ - minZ);
    return {
        minX,
        minZ,
        scale,
        offsetX: MAP_PADDING + (inner - (maxX - minX) * scale) / 2,
        offsetY: MAP_PADDING + (inner - (maxZ - minZ) * scale) / 2,
    };
}

const MAP_PADDING = 6;
