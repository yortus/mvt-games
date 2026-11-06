import { advanceTime } from '@mvtjs/html';
import { htmlTest } from 'v-snap';
import '../../penrose-tiling.css';
import { SHIFT_STEP } from '../../data';
import { createLabModel, createMultigridTiles, type LabModel } from '../../models';
import type { ColorMode } from '../color-mode';
import { createLookViewModel, type LookViewModel } from '../look-view-model';
import type { PaletteName } from '../palette-name';
import { TileCanvasView } from '../tile-canvas-view';

htmlTest('the Penrose tiling in sunset, coloured by shape', () => pose({ palette: 'sunset', colorMode: 'shapes' }));

htmlTest('coloured by direction', () => pose({ palette: 'jewel', colorMode: 'directions' }));

htmlTest('coloured in rings', () => pose({ palette: 'lagoon', colorMode: 'rings', radius: 24 }));

htmlTest('coloured in a spiral', () => pose({ palette: 'ember', colorMode: 'spiral', radius: 24 }));

htmlTest('seven-fold, turned', () => pose({ palette: 'aurora', colorMode: 'shapes', symmetry: 7, rotation: 0.4 }));

htmlTest('twelve-fold, with wide gaps', () => pose({ palette: 'blossom', colorMode: 'shapes', symmetry: 12, gap: 0.24 }));

htmlTest('three-fold, as cubes, with no gaps', () => pose({ palette: 'ink', colorMode: 'directions', symmetry: 3, gap: 0 }));

htmlTest('away from the middle, closer in', () => pose({ palette: 'orchard', colorMode: 'rings', centreX: 40, centreY: -25, radius: 5 }));

htmlTest('half way through a dissolve, with some tiles between two places', async () => {
    const { model, look } = createLab();
    model.scope.radius = 5;
    model.tiling.shift = 2.5 * SHIFT_STEP + 0.3125;
    await advanceTime(16, model);
    return poseLab(model, look);
});

htmlTest('touching, at the bottom of the slider', () => {
    const { model, look } = createLab();
    look.gridReveal = 0;
    return poseLab(model, look);
});

htmlTest('part way back to the grids', () => {
    const { model, look } = createLab();
    look.gridReveal = 0.5;
    return poseLab(model, look);
});

htmlTest('nearly back, with the tiles small at their crossings', () => {
    const { model, look } = createLab();
    look.gridReveal = 0.8;
    return poseLab(model, look);
});

htmlTest('only the lines, at the top of the slider', () => {
    const { model, look } = createLab();
    look.gridReveal = 1;
    return poseLab(model, look);
});

htmlTest('the grids, with a tile picked out', () => {
    const { model, look } = createLab();
    look.gridReveal = 0.8;
    model.tiling.pickTile(look.findDrawnTile(1, 1));
    return poseLab(model, look);
});

htmlTest('the grids of the squares, which cross in a plain lattice', async () => {
    const { model, look } = createLab();
    model.tiling.symmetry = 4;
    look.gridReveal = 1;
    await advanceTime(16, model);
    return poseLab(model, look);
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Pose {
    readonly palette: PaletteName;
    readonly colorMode: ColorMode;
    readonly symmetry?: number;
    readonly radius?: number;
    readonly rotation?: number;
    readonly gap?: number;
    readonly centreX?: number;
    readonly centreY?: number;
}

/** The canvas, in the stage the stylesheet gives it, with tiles laid as the model would lay them. */
function pose(options: Pose): Element {
    const { centreX = 0, centreY = 0, radius = 12, symmetry = 5 } = options;
    const tiles = createMultigridTiles();
    tiles.lay(symmetry, 0.1, centreX, centreY, radius * 1.3);
    const canvas = TileCanvasView({
        tiles: () => tiles,
        centreX: () => centreX,
        centreY: () => centreY,
        radius: () => radius,
        rotation: () => options.rotation ?? 0,
        palette: () => options.palette,
        colorMode: () => options.colorMode,
        colorOffset: () => 0,
        gap: () => options.gap ?? 0.06,
        nextTiles: () => tiles,
        tileBlend: () => 0,
        drawBack: () => 0,
        pickedTile: () => -1,
        picturesAsked: () => 0,
    });
    return placeOnStage(canvas);
}

/** A scope, and how the tiling under it looks. */
function createLab(): { model: LabModel; look: LookViewModel } {
    const model = createLabModel({ seed: 1 });
    const look = createLookViewModel({ tiles: () => model.tiling.tiles, isDrifting: () => model.tiling.isDrifting });
    return { model, look };
}

/** The canvas, showing what's under the scope as the entry shows it. */
function poseLab(model: LabModel, look: LookViewModel): Element {
    return placeOnStage(TileCanvasView({
        tiles: () => model.tiling.tiles,
        nextTiles: () => model.tiling.nextTiles,
        tileBlend: () => model.tiling.tileBlend,
        centreX: () => model.scope.centreX,
        centreY: () => model.scope.centreY,
        radius: () => model.scope.radius,
        rotation: () => model.scope.rotation,
        palette: () => look.palette,
        colorMode: () => look.colorMode,
        colorOffset: () => look.colorOffset,
        gap: () => look.gap,
        drawBack: () => look.drawBack,
        pickedTile: () => model.tiling.pickedTile,
        picturesAsked: () => 0,
    }));
}

/** The canvas, in the stage the stylesheet gives it. */
function placeOnStage(canvas: Element): Element {
    const root = document.createElement('div');
    root.className = 'penrose-tiling';
    root.style.cssText = 'width:480px;height:320px;';
    const stage = document.createElement('div');
    stage.className = 'tiling-stage';
    stage.append(canvas);
    root.append(stage);
    return root;
}
