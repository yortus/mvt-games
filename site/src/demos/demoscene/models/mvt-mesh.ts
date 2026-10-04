// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A solid made of four-sided faces, in object space: x right, y up, z away
 * from the viewer. Flat arrays, so whoever draws it can turn it without
 * making objects.
 */
export interface Mesh {
    /** x, y, z for each vertex. */
    readonly vertices: Float32Array;
    readonly vertexCount: number;
    /** Four vertex indices for each face, in order around it. */
    readonly faces: Uint16Array;
    readonly faceCount: number;
    /** x, y, z of each face's outward unit normal. */
    readonly normals: Float32Array;
}

// ---------------------------------------------------------------------------
// Mesh
// ---------------------------------------------------------------------------

/**
 * The letters M, V and T as solids: each stroke a flat four-sided outline,
 * pushed out to a thickness. Six units wide and two high, centred on the
 * origin. The vectors part turns it.
 */
export const MVT_MESH: Mesh = buildMesh();

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildMesh(): Mesh {
    /** Half the letters' thickness. */
    const HALF_DEPTH = 0.3;

    /** Each stroke's outline in x, y pairs, going round it. All are convex. */
    const STROKES: readonly (readonly number[])[] = [
        // M: two stems and two diagonals meeting in the middle
        [-3.0, -1, -2.5, -1, -2.5, 1, -3.0, 1],
        [-1.7, -1, -1.2, -1, -1.2, 1, -1.7, 1],
        [-2.5, 1, -2.5, 0.35, -2.1, -0.25, -2.1, 0.4],
        [-1.7, 1, -1.7, 0.35, -2.1, -0.25, -2.1, 0.4],
        // V: two strokes meeting at the bottom
        [-0.9, 1, -0.25, -1, 0.25, -1, -0.4, 1],
        [0.9, 1, 0.4, 1, -0.25, -1, 0.25, -1],
        // T: a bar and a stem
        [1.2, 1, 3.0, 1, 3.0, 0.5, 1.2, 0.5],
        [1.85, 0.5, 2.35, 0.5, 2.35, -1, 1.85, -1],
    ];

    const vertexCount = STROKES.length * 8;
    const faceCount = STROKES.length * 6;
    const vertices = new Float32Array(vertexCount * 3);
    const faces = new Uint16Array(faceCount * 4);
    const normals = new Float32Array(faceCount * 3);

    let face = 0;
    for (let s = 0; s < STROKES.length; s++) {
        const outline = STROKES[s];
        const base = s * 8;
        // Vertices 0-3 are the outline at the front (z < 0), 4-7 the same at the back
        for (let i = 0; i < 4; i++) {
            setVertex(base + i, outline[i * 2], outline[i * 2 + 1], -HALF_DEPTH);
            setVertex(base + 4 + i, outline[i * 2], outline[i * 2 + 1], HALF_DEPTH);
        }
        addFace(base, base + 0, base + 1, base + 2, base + 3);
        addFace(base, base + 4, base + 5, base + 6, base + 7);
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            addFace(base, base + i, base + next, base + 4 + next, base + 4 + i);
        }
    }
    return { vertices, vertexCount, faces, faceCount, normals };

    function setVertex(index: number, x: number, y: number, z: number): void {
        vertices[index * 3] = x;
        vertices[index * 3 + 1] = y;
        vertices[index * 3 + 2] = z;
    }

    /** Adds a face, with its normal turned to point away from the middle of its stroke. */
    function addFace(strokeBase: number, a: number, b: number, c: number, d: number): void {
        faces[face * 4] = a;
        faces[face * 4 + 1] = b;
        faces[face * 4 + 2] = c;
        faces[face * 4 + 3] = d;

        // The normal from two edges; a, b, c may be in a line on a thin stroke, so try b, c, d too
        let [nx, ny, nz] = cross(a, b, c);
        if (nx * nx + ny * ny + nz * nz < 1e-9) [nx, ny, nz] = cross(b, c, d);
        const length = Math.hypot(nx, ny, nz);
        nx /= length;
        ny /= length;
        nz /= length;

        // Outward: away from the stroke's centre
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (let i = 0; i < 8; i++) {
            cx += vertices[(strokeBase + i) * 3] / 8;
            cy += vertices[(strokeBase + i) * 3 + 1] / 8;
            cz += vertices[(strokeBase + i) * 3 + 2] / 8;
        }
        const fx = (vertices[a * 3] + vertices[c * 3]) / 2 - cx;
        const fy = (vertices[a * 3 + 1] + vertices[c * 3 + 1]) / 2 - cy;
        const fz = (vertices[a * 3 + 2] + vertices[c * 3 + 2]) / 2 - cz;
        const sign = nx * fx + ny * fy + nz * fz < 0 ? -1 : 1;
        normals[face * 3] = nx * sign;
        normals[face * 3 + 1] = ny * sign;
        normals[face * 3 + 2] = nz * sign;
        face++;
    }

    function cross(a: number, b: number, c: number): [number, number, number] {
        const ux = vertices[b * 3] - vertices[a * 3];
        const uy = vertices[b * 3 + 1] - vertices[a * 3 + 1];
        const uz = vertices[b * 3 + 2] - vertices[a * 3 + 2];
        const vx = vertices[c * 3] - vertices[a * 3];
        const vy = vertices[c * 3 + 1] - vertices[a * 3 + 1];
        const vz = vertices[c * 3 + 2] - vertices[a * 3 + 2];
        return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    }
}
