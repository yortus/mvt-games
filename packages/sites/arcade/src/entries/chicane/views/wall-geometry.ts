import { Geometry3D } from '@pixi/3d';
import type { Track, TrackSample } from '../models';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WallGeometryOptions {
    /** The track, whose wall it follows. */
    readonly track: Track;
    /** Which side of the track the wall is on: the left (1) or the right (-1). */
    readonly side: 1 | -1;
    /** How tall it is. */
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an upright wall that follows the track at the wall's distance
 * from its centre line, which comes closer on the inside of a tight bend.
 * Each stretch has a face on both sides, so the wall shows from the track
 * and from beyond it.
 */
export function createWallGeometry(options: WallGeometryOptions): Geometry3D {
    const { track, side: wallSide, height } = options;
    const { samples } = track;
    const count = samples.length;
    // Two quads a stretch, one for each face, of four corners each
    const positions = new Float32Array(count * 8 * 3);
    const normals = new Float32Array(count * 8 * 3);
    const indices = new Uint32Array(count * 12);
    // The face toward the track points back across it
    const towardTrack = -wallSide;
    for (let i = 0; i < count; i++) {
        const next = (i + 1) % count;
        const a = samples[i];
        const b = samples[next];
        const aOffset = wallSide * track.findWallOffset(i, wallSide);
        const bOffset = wallSide * track.findWallOffset(next, wallSide);
        const v = i * 8;
        for (let face = 0; face < 2; face++) {
            const base = v + face * 4;
            writeCorner(positions, base, a, aOffset, 0);
            writeCorner(positions, base + 1, a, aOffset, height);
            writeCorner(positions, base + 2, b, bOffset, 0);
            writeCorner(positions, base + 3, b, bOffset, height);
            // The face's normal is the track's left, (dz, -dx), turned toward or away from the track
            const side = face === 0 ? towardTrack : -towardTrack;
            const nx = a.directionZ * side;
            const nz = -a.directionX * side;
            for (let corner = 0; corner < 4; corner++) {
                normals[(base + corner) * 3] = nx;
                normals[(base + corner) * 3 + 2] = nz;
            }
            // Each face is wound counterclockwise as seen from the side it faces
            const facesLeft = side > 0;
            indices.set(facesLeft ? [base, base + 1, base + 2, base + 1, base + 3, base + 2] : [base, base + 2, base + 1, base + 1, base + 2, base + 3], (i * 2 + face) * 6);
        }
    }
    return new Geometry3D({ positions, normals, indices });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Writes the point `offset` to the left of a sample, at `y`, as vertex `index`. */
function writeCorner(positions: Float32Array, index: number, sample: TrackSample, offset: number, y: number): void {
    positions[index * 3] = sample.x + sample.directionZ * offset;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = sample.z - sample.directionX * offset;
}
