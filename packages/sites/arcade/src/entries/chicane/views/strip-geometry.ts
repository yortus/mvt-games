import { Geometry3D } from '@pixi/3d';
import type { TrackSample } from '../models';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface StripGeometryOptions {
    /** The track's samples, in order round the loop. */
    readonly samples: readonly TrackSample[];
    /** The strip's two edges, as distances from the centre line, positive to the left. */
    readonly fromOffset: number;
    readonly toOffset: number;
    /** How high it floats above the ground, so strips laid over each other don't flicker. */
    readonly height: number;
    /** Whether the stretch from sample `index` to the next one is part of the strip. Absent, they all are. */
    readonly includes?: (index: number) => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a flat strip that follows the track, facing up, such as the
 * asphalt, a kerb, or the dashes down the middle. Each stretch between two
 * samples is its own quad, so a strip can leave gaps.
 */
export function createStripGeometry(options: StripGeometryOptions): Geometry3D {
    const { samples, fromOffset, toOffset, height, includes } = options;
    const count = samples.length;
    let quads = 0;
    for (let i = 0; i < count; i++) if (includes === undefined || includes(i)) quads++;

    const positions = new Float32Array(quads * 4 * 3);
    const normals = new Float32Array(quads * 4 * 3);
    const uvs = new Float32Array(quads * 4 * 2);
    const indices = new Uint32Array(quads * 6);
    let quad = 0;
    for (let i = 0; i < count; i++) {
        if (includes !== undefined && !includes(i)) continue;
        const a = samples[i];
        const b = samples[(i + 1) % count];
        // The corners are a's two edges, then b's
        const v = quad * 4;
        writeCorner(positions, v, a, fromOffset, height);
        writeCorner(positions, v + 1, a, toOffset, height);
        writeCorner(positions, v + 2, b, fromOffset, height);
        writeCorner(positions, v + 3, b, toOffset, height);
        for (let corner = 0; corner < 4; corner++) normals[(v + corner) * 3 + 1] = 1;
        uvs.set([0, 0, 1, 0, 0, 1, 1, 1], v * 2);
        // Wound counterclockwise seen from above, so the strip faces up, whichever way round its offsets are
        const isRightToLeft = toOffset > fromOffset;
        indices.set(isRightToLeft ? [v, v + 2, v + 1, v + 1, v + 2, v + 3] : [v, v + 1, v + 2, v + 1, v + 3, v + 2], quad * 6);
        quad++;
    }
    return new Geometry3D({ positions, normals, uvs, indices });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Writes the point `offset` to the left of a sample, at `height`, as vertex `index`. */
function writeCorner(positions: Float32Array, index: number, sample: TrackSample, offset: number, height: number): void {
    // The track's left is (dz, -dx)
    positions[index * 3] = sample.x + sample.directionZ * offset;
    positions[index * 3 + 1] = height;
    positions[index * 3 + 2] = sample.z - sample.directionX * offset;
}
