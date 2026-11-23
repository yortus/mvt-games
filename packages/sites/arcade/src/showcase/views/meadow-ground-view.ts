import { Container3D, FlatMaterial, Mesh3D } from '@pixi/3d';
import { ownResources, setRefresh } from '@mvtjs/pixi-3d';
import type { MeadowTerrain } from '../models';
import { createMeadowChunkGeometry, MEADOW_CHUNK_SIZE, type MeadowChunkDetail } from './meadow-chunk-geometry';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MeadowGroundViewBindings {
    readonly terrain: MeadowTerrain;
    /** Where the player stands, in metres. */
    readonly playerX: () => number;
    readonly playerZ: () => number;
    /** Whether the meadow is in view. The view waits until it is to build any chunks. */
    readonly isShown: () => boolean;
}

/**
 * How far down the valley the ground reaches, in metres, at the least. The
 * haze must hide everything before this distance, so the ground's end never shows.
 */
export const MEADOW_GROUND_REACH = 16 * MEADOW_CHUNK_SIZE;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The meadow's ground, a long way down the valley either way, as far as the
 * haze. It's built in square chunks. As the player walks, the view builds
 * the chunks coming into view, nearest first. It builds only a few each
 * frame, so a frame never does too much. It frees the chunks left
 * behind. The valley goes on forever, but only the chunks near the player
 * exist, and only those along the valley. The hills hide everything past them.
 *
 * The chunks near the player have every detail. Those further off are
 * built with less, which the distance hides, so many more fit in view. As
 * the player walks toward a far chunk, it's built again in full.
 */
export function MeadowGroundView({ terrain, playerX, playerZ, isShown }: MeadowGroundViewBindings): Container3D {
    const groundMaterial = new FlatMaterial({ vertexColors: true, doubleSided: true });
    const waterMaterial = new FlatMaterial({ vertexColors: true, doubleSided: true, alphaMode: 'blend', alpha: WATER_ALPHA });
    const view = ownResources(new Container3D(), [groundMaterial, waterMaterial]);
    /** The chunks built, by their key. */
    const chunks = new Map<number, BuiltChunk>();
    /** Filled in by each call to `rowsAlongValley`, so finding the rows doesn't make an object. */
    const rowSpan: RowSpan = { first: 0, last: 0 };
    // Which chunk the player was in when the chunks were last sorted out, and whether every chunk in view is built as it should be
    let centreCol = Number.NaN;
    let centreRow = Number.NaN;
    let isComplete = false;

    setRefresh(view, () => {
        if (!isShown()) return;
        const col = Math.floor(playerX() / MEADOW_CHUNK_SIZE);
        const row = Math.floor(playerZ() / MEADOW_CHUNK_SIZE);
        if (col !== centreCol || row !== centreRow) {
            centreCol = col;
            centreRow = row;
            isComplete = false;
            releaseFarChunks();
        }
        if (!isComplete) buildNearestChunks();
    });
    // Each chunk has a geometry of its own. When the view is destroyed, it frees the geometry of every chunk still built
    view.on('destroyed', () => {
        chunks.forEach((built) => {
            for (let i = 0; i < built.meshes.length; i++) built.meshes[i].geometry.destroy(true);
        });
        chunks.clear();
    });
    return view;

    /**
     * Builds some of the chunks in view that are missing, or built with too
     * little detail, nearest first, ring by ring, until this frame's budget
     * is spent. A chunk built in full costs more of it than a far one.
     */
    function buildNearestChunks(): void {
        let budget = BUILD_BUDGET;
        for (let ring = 0; ring <= FAR_RADIUS; ring++) {
            const detail: MeadowChunkDetail = ring <= NEAR_RADIUS ? 'near' : 'far';
            for (let c = centreCol - ring; c <= centreCol + ring; c++) {
                const { first, last } = rowsAlongValley(c);
                for (let r = Math.max(first, centreRow - ring); r <= Math.min(last, centreRow + ring); r++) {
                    // Only the ring's edge, since its inside was the rings before
                    if (Math.max(Math.abs(c - centreCol), Math.abs(r - centreRow)) !== ring) continue;
                    const built = chunks.get(keyOf(c, r));
                    // A chunk built in full is good enough at any distance
                    if (built !== undefined && (built.detail === 'near' || detail === 'far')) continue;
                    const cost = detail === 'near' ? NEAR_COST : FAR_COST;
                    if (cost > budget) return;
                    if (built !== undefined) releaseChunk(c, r, built);
                    buildChunk(c, r, detail);
                    budget -= cost;
                }
            }
        }
        isComplete = true;
    }

    /** The first and last rows of chunks, in column `col`, that reach the part of the valley in sight. That's its floor, and its hillsides up past the ridges. */
    function rowsAlongValley(col: number): RowSpan {
        const middle = terrain.valleyMiddleAt((col + 0.5) * MEADOW_CHUNK_SIZE);
        rowSpan.first = Math.floor((middle - VALLEY_SEEN_HALF_WIDTH) / MEADOW_CHUNK_SIZE);
        rowSpan.last = Math.floor((middle + VALLEY_SEEN_HALF_WIDTH) / MEADOW_CHUNK_SIZE);
        return rowSpan;
    }

    function buildChunk(col: number, row: number, detail: MeadowChunkDetail): void {
        const geometry = createMeadowChunkGeometry({
            terrain,
            firstCol: col * MEADOW_CHUNK_SIZE,
            firstRow: row * MEADOW_CHUNK_SIZE,
            size: MEADOW_CHUNK_SIZE,
            detail,
        });
        const meshes = [new Mesh3D({ geometry: geometry.ground, material: groundMaterial })];
        if (geometry.water !== undefined) meshes.push(new Mesh3D({ geometry: geometry.water, material: waterMaterial }));
        for (let i = 0; i < meshes.length; i++) view.addChild(meshes[i]);
        chunks.set(keyOf(col, row), { meshes, detail });
    }

    /**
     * Frees the chunks a ring past the edge of the view, so stepping to and
     * fro over a chunk's edge keeps them. A chunk built in full that is now
     * well out among the far ones is freed too, to be built again with less
     * detail.
     */
    function releaseFarChunks(): void {
        chunks.forEach((built, key) => {
            const col = Math.floor(key / KEY_SPAN) - KEY_OFFSET;
            const row = (key % KEY_SPAN) - KEY_OFFSET;
            const ring = Math.max(Math.abs(col - centreCol), Math.abs(row - centreRow));
            if (ring > FAR_RADIUS + 1 || (built.detail === 'near' && ring > NEAR_RADIUS + 1)) releaseChunk(col, row, built);
        });
    }

    function releaseChunk(col: number, row: number, built: BuiltChunk): void {
        chunks.delete(keyOf(col, row));
        for (let i = 0; i < built.meshes.length; i++) {
            view.removeChild(built.meshes[i]);
            const geometry = built.meshes[i].geometry;
            built.meshes[i].destroy();
            geometry.destroy(true);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface BuiltChunk {
    readonly meshes: Mesh3D[];
    readonly detail: MeadowChunkDetail;
}

interface RowSpan {
    first: number;
    last: number;
}

/** How many chunks out from the player's are built in full, and how many are built at all. */
const NEAR_RADIUS = 3;
const FAR_RADIUS = MEADOW_GROUND_REACH / MEADOW_CHUNK_SIZE;
/**
 * How far either side of the valley's middle the chunks are built, in
 * metres. It's a little past the ridges, which hide the ground beyond.
 */
const VALLEY_SEEN_HALF_WIDTH = 76;
/** How much building a frame may do, and what a chunk built in full or with less detail costs of it. */
const BUILD_BUDGET = 6;
const NEAR_COST = 3;
const FAR_COST = 1;
const WATER_ALPHA = 0.78;
/** A chunk's key is one number, made from its column and row, so finding a chunk doesn't build a string. */
const KEY_SPAN = 65536;
const KEY_OFFSET = 32768;

function keyOf(col: number, row: number): number {
    return (col + KEY_OFFSET) * KEY_SPAN + (row + KEY_OFFSET);
}
