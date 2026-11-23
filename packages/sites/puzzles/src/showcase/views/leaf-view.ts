import { Container3D, Geometry3D, Material3D, Mesh3D } from '@pixi/3d';
import { Texture } from 'pixi.js';
import { ownResources, setRefresh, SKIP_DESCENDANTS } from '@mvtjs/pixi-3d';
import type { TurnDirection } from '../models';
import { bendLeaf, LEAF_SEGMENTS, LEAF_VERTEX_COUNT } from './bend-leaf';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LeafViewBindings {
    /** How far over the leaf has turned, from 0, flat to the right of the spine, to 1, flat to the left. */
    readonly turn: () => number;
    /** Which way it's turning, which decides which edge leads. */
    readonly direction: () => TurnDirection;
    /** The pictures of the page on its front, and the page on its back. Undefined leaves that side out, and both undefined hides the leaf. */
    readonly front: () => Texture | undefined;
    readonly back: () => Texture | undefined;
    /** How high its spine lies above the desk, in metres. */
    readonly y: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A leaf of the paper: one sheet, with a page on each side, hinged at the
 * spine. Each side is a mesh of its own, since each shows its own page, and
 * the back faces the other way. Both bend as the leaf turns, the points
 * written in place, and they are bent again only when the turn changes.
 * When the view is destroyed, it frees each side's geometry and material.
 * It doesn't free the pages' pictures, since the code that printed them
 * owns them.
 */
export function LeafView({ turn, direction, front, back, y }: LeafViewBindings): Container3D {
    const view = new Container3D();
    view.position.y = y;
    const frontSide = createSide(false);
    const backSide = createSide(true);
    view.addChild(frontSide.mesh, backSide.mesh);
    ownResources(view, [frontSide.geometry, frontSide.material, backSide.geometry, backSide.material]);
    let drawnTurn = NaN;
    let drawnDirection: TurnDirection | undefined;

    setRefresh(view, () => {
        const frontPage = front();
        const backPage = back();
        const isShown = frontPage !== undefined || backPage !== undefined;
        view.visible = isShown;
        if (!isShown) return SKIP_DESCENDANTS;
        showPage(frontSide, frontPage);
        showPage(backSide, backPage);
        const nextTurn = turn();
        const nextDirection = direction();
        if (nextTurn === drawnTurn && nextDirection === drawnDirection) return undefined;
        drawnTurn = nextTurn;
        drawnDirection = nextDirection;
        bendLeaf(nextTurn, nextDirection, frontSide.positions, frontSide.normals);
        // The back is the same sheet, facing the other way
        for (let i = 0; i < LEAF_VERTEX_COUNT * 3; i++) {
            backSide.positions[i] = frontSide.positions[i];
            backSide.normals[i] = -frontSide.normals[i];
        }
        updateBuffers(frontSide);
        updateBuffers(backSide);
        return undefined;
    });
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface LeafSide {
    readonly mesh: Mesh3D;
    readonly geometry: Geometry3D;
    readonly material: Material3D;
    readonly positions: Float32Array;
    readonly normals: Float32Array;
    shown: Texture | undefined;
}

/**
 * Makes one side of the leaf. The front's picture runs from the spine out,
 * left to right. The back is seen from the other side once the leaf has
 * turned, so its picture runs the other way, and its triangles wind the
 * other way, to face away from the front.
 */
function createSide(isBack: boolean): LeafSide {
    const columns = LEAF_SEGMENTS + 1;
    const uvs = new Float32Array(LEAF_VERTEX_COUNT * 2);
    for (let row = 0; row < 2; row++) {
        for (let i = 0; i < columns; i++) {
            const v = row * columns + i;
            uvs[v * 2] = isBack ? 1 - i / LEAF_SEGMENTS : i / LEAF_SEGMENTS;
            // The top edge, at -z, shows the top of the page
            uvs[v * 2 + 1] = row;
        }
    }
    const indices = new Uint16Array(LEAF_SEGMENTS * 6);
    for (let i = 0; i < LEAF_SEGMENTS; i++) {
        const top = i;
        const foot = i + columns;
        if (isBack) indices.set([top, top + 1, foot, top + 1, foot + 1, foot], i * 6);
        else indices.set([top, foot, top + 1, top + 1, foot, foot + 1], i * 6);
    }
    const geometry = new Geometry3D({
        positions: new Float32Array(LEAF_VERTEX_COUNT * 3),
        normals: new Float32Array(LEAF_VERTEX_COUNT * 3),
        uvs,
        indices,
        dynamic: true,
        quantizeNormals: false,
    });
    // Until its page is shown, a side shows plain white, so the material always has a picture
    const material = new Material3D({ baseColorTexture: Texture.WHITE, roughness: 0.95, metallic: 0 });
    return {
        mesh: new Mesh3D({ geometry, material }),
        geometry,
        material,
        positions: geometry.positions as Float32Array,
        normals: geometry.normals as Float32Array,
        shown: undefined,
    };
}

function showPage(side: LeafSide, page: Texture | undefined): void {
    side.mesh.visible = page !== undefined;
    if (page === undefined || page === side.shown) return;
    side.shown = page;
    side.material.textures.baseColor = page;
}

function updateBuffers(side: LeafSide): void {
    side.geometry.attributes.aPosition.buffer.update();
    side.geometry.attributes.aNormal.buffer.update();
}
