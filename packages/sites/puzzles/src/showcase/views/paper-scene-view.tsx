/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, CubeGeometry, Material3D } from '@pixi/3d';
import type { Texture } from 'pixi.js';
import type { PlayRect } from '@mvtjs/site-kit/entry-types';
import type { ScreenPlacement } from '@mvtjs/site-kit/showcase';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../data';
import type { GameModel } from '../models';
import { DeskView } from './desk-view';
import { LeafView } from './leaf-view';
import { MarginGameView } from './margin-game-view';
import { findReadingCentre } from './paper-camera';
import { PaperCameraView } from './paper-camera-view';
import { createPageTexture } from './page-texture';
import { LEAF_Y, TURNING_LIFT } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PaperSceneViewBindings {
    readonly model: GameModel;
    /** Each puzzle's name and picture, by its index in the paper's list, for the pages. */
    readonly puzzleNames: readonly string[];
    readonly puzzlePictures: readonly Texture[];
    /** The box of each spread's puzzle, as a screen lying on the desk, by the spread, if it has one. */
    readonly puzzleScreens: readonly (ScreenPlacement | undefined)[];
    /** Where the page will play the puzzle at `index`, in the view's pixels, if the paper runs in the page. */
    readonly playRectAt: (index: number) => PlayRect | undefined;
    /** How wide the paper's view is, in pixels, as it fits itself to the page. */
    readonly viewWidth: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The paper on the desk, in 3D, through the reader's eyes. What's open lies
 * flat, a leaf each side of the spine, on the piles of leaves under them, and
 * a page turning is a third leaf, bending as it goes over.
 *
 * Each page is printed on a canvas as it's first needed, and kept while
 * it's near the spread open. While the reader reads, the pages of the
 * spreads either side are printed ahead, one a frame, so a turn finds its
 * pages ready. When the scene is destroyed, it frees the pages that it
 * still keeps.
 */
export function PaperSceneView(bindings: PaperSceneViewBindings): Container3D {
    const { model, puzzleNames, puzzlePictures, puzzleScreens, playRectAt, viewWidth } = bindings;
    const { layout } = model;
    const lastPage = layout.pages.length - 1;
    const textures: (Texture | undefined)[] = new Array<Texture | undefined>(layout.pages.length).fill(undefined);
    const edges = new Material3D({ baseColor: 0xd8d1c2, roughness: 1 });
    // A pile's edges: one box, its height the leaves' height above the desk, inset a hair so the leaves cover its top
    const pile = new CubeGeometry({ width: PAGE_WIDTH - 0.002, height: PILE_HEIGHT, depth: PAGE_HEIGHT - 0.002 });
    const isTurning = (): boolean => model.mode === 'turning';
    const isForward = (): boolean => model.turnDirection === 'forward';

    /** How far over the turning leaf has gone, eased, so it starts slowly, speeds up, and settles. */
    const turnAmount = (): number => {
        const p = model.turnProgress;
        const eased = p * p * (3 - 2 * p);
        return isForward() ? eased : 1 - eased;
    };
    /** The page at `index`, printed, or undefined for a page that isn't there. */
    const pageAt = (index: number): Texture | undefined => (index < 0 || index > lastPage ? undefined : printPage(index));

    // The pages showing, by their indexes in the list. While reading, spread s shows pages 2s - 1 and 2s.
    // Turning forward from s, its right-hand leaf turns over, showing 2s and 2s + 1, to uncover 2s + 2.
    // Turning back, the left-hand leaf turns back, showing 2s - 2 and 2s - 1, to uncover 2s - 3
    const leftPage = (): number => {
        const s = model.spread;
        return isTurning() && !isForward() ? 2 * s - 3 : 2 * s - 1;
    };
    const rightPage = (): number => {
        const s = model.spread;
        return isTurning() && isForward() ? 2 * s + 2 : 2 * s;
    };
    const turningFront = (): number => (isForward() ? 2 * model.spread : 2 * model.spread - 2);

    return (
        <group onRefresh={keepNearbyPages} onDestroyed={releasePages} owns={[edges, pile]}>
            <PaperCameraView
                centreX={() => findReadingCentre(model, viewWidth())}
                screenInPlay={() => (model.puzzleInPlay === undefined ? undefined : puzzleScreens[model.spread])}
                rectInPlay={() => (model.puzzleInPlay === undefined ? undefined : playRectAt(model.puzzleInPlay))}
                lean={() => model.lean}
                viewWidth={viewWidth}
            />
            <directionalLight color={0xfff3e6} intensity={3.4} x={-0.6} y={1.6} z={0.9} lookAt={ORIGIN} />
            <DeskView />
            <mesh geometry={pile} material={edges} x={-PAGE_WIDTH / 2} y={PILE_HEIGHT / 2} visible={() => leftPage() >= 1} />
            <mesh geometry={pile} material={edges} x={PAGE_WIDTH / 2} y={PILE_HEIGHT / 2} visible={() => rightPage() <= lastPage - 1} />
            <LeafView turn={() => 1} direction={() => 'forward'} front={() => undefined} back={() => pageAt(leftPage())} y={LEAF_Y} />
            <LeafView turn={() => 0} direction={() => 'forward'} front={() => pageAt(rightPage())} back={() => undefined} y={LEAF_Y} />
            <LeafView
                turn={turnAmount}
                direction={() => model.turnDirection}
                front={() => (isTurning() ? pageAt(turningFront()) : undefined)}
                back={() => (isTurning() ? pageAt(turningFront() + 1) : undefined)}
                y={LEAF_Y + TURNING_LIFT}
            />
            <MarginGameView game={model.marginGame} isShown={() => model.spread === model.spreadCount - 1 && !isTurning()} />
        </group>
    );

    function printPage(index: number): Texture {
        let texture = textures[index];
        if (texture === undefined) {
            texture = createPageTexture({ layout, page: layout.pages[index], puzzleNames, puzzlePictures });
            textures[index] = texture;
        }
        return texture;
    }

    /**
     * Destroys the pages far from the spread open, and while reading,
     * prints one page of the spreads either side, if any is still to print.
     */
    function keepNearbyPages(): void {
        const first = 2 * model.spread - 3;
        const last = 2 * model.spread + 2;
        for (let index = 0; index <= lastPage; index++) {
            const texture = textures[index];
            if (texture === undefined || (index >= first && index <= last)) continue;
            textures[index] = undefined;
            texture.destroy(true);
        }
        if (model.mode !== 'reading') return;
        for (let index = Math.max(0, first); index <= Math.min(lastPage, last); index++) {
            if (textures[index] !== undefined) continue;
            printPage(index);
            return;
        }
    }

    function releasePages(): void {
        for (let index = 0; index <= lastPage; index++) {
            textures[index]?.destroy(true);
            textures[index] = undefined;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const ORIGIN = { x: 0, y: 0, z: 0 } as const;
/** The piles' height, up to the open leaves, less a hair, so the leaves cover their tops. */
const PILE_HEIGHT = LEAF_Y - 0.0003;
