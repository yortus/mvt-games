/** @jsxImportSource @mvtjs/html */
import { SYMMETRIES } from '../data';
import type { LabModel } from '../models';
import { COLOR_MODES } from './color-mode';
import { listenToKeys } from './listen-to-keys';
import { createLookViewModel } from './look-view-model';
import { PALETTE_NAMES } from './palette-name';
import { TileCanvasView } from './tile-canvas-view';
import { TilingPanelView } from './tiling-panel-view';
import { SHIFT_PER_KEY } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TilingViewBindings {
    readonly model: LabModel;
    /** Whether the keyboard works the tiling. It doesn't while the tiling plays only to be watched. */
    readonly takesKeys: boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The tiling, as the visitor sees and works it: the canvas, filling what it
 * is given, and the panel beside it, or below it on a narrow screen.
 *
 * It owns the look's view model, which the canvas and the panel share. The
 * look, whether the panel shows, and the pictures asked for are presentation,
 * so they live here rather than in the model, and the look advances in this
 * view's update step.
 *
 * It is also the one place where what the visitor does meets what it means.
 * The views below it only report, and here every key, gesture, slider and
 * button is wired to the tiling, the scope or the look. To change what a
 * control does, change it here.
 */
export function TilingView(bindings: TilingViewBindings): Element {
    const { takesKeys } = bindings;
    const { tiling, scope } = bindings.model;
    let isPanelShown = true;
    let picturesAsked = 0;
    const look = createLookViewModel({ tiles: () => tiling.tiles, isDrifting: () => tiling.isDrifting });

    const stopListening = listenToKeys({
        isActive: () => takesKeys,
        pressed: {
            ' ': toggleDrift,
            '[': () => stepSymmetry(-1),
            ']': () => stepSymmetry(1),
            'c': () => stepPalette(1),
            'C': () => stepPalette(-1),
            'v': () => stepColorMode(1),
            'V': () => stepColorMode(-1),
            'x': surprise,
            'g': look.toggleGrids,
            'r': scope.reset,
            'h': togglePanel,
            'p': askForPicture,
        },
        repeating: {
            ',': () => { tiling.shift -= SHIFT_PER_KEY; },
            '.': () => { tiling.shift += SHIFT_PER_KEY; },
        },
        held: {
            'ArrowLeft': 'left',
            'a': 'left',
            'ArrowRight': 'right',
            'd': 'right',
            'ArrowUp': 'up',
            'w': 'up',
            'ArrowDown': 'down',
            's': 'down',
            '+': 'zoom in',
            '=': 'zoom in',
            '-': 'zoom out',
            '_': 'zoom out',
            'e': 'clockwise',
            'q': 'anticlockwise',
        },
        onHeldChanged(isHeld) {
            scope.travelX = (isHeld('right') ? 1 : 0) - (isHeld('left') ? 1 : 0);
            scope.travelY = (isHeld('down') ? 1 : 0) - (isHeld('up') ? 1 : 0);
            scope.zooming = isHeld('zoom in') === isHeld('zoom out') ? 'none' : isHeld('zoom in') ? 'in' : 'out';
            scope.turning = isHeld('clockwise') === isHeld('anticlockwise') ? 'none' : isHeld('clockwise') ? 'clockwise' : 'anticlockwise';
        },
    });

    return (
        <div class="penrose-tiling" onUpdate={look.update} onDestroyed={stopListening}>
            <div class="tiling-stage">
                <TileCanvasView
                    tiles={() => tiling.tiles}
                    nextTiles={() => tiling.nextTiles}
                    tileBlend={() => tiling.tileBlend}
                    centreX={() => scope.centreX}
                    centreY={() => scope.centreY}
                    radius={() => scope.radius}
                    rotation={() => scope.rotation}
                    palette={() => look.palette}
                    colorMode={() => look.colorMode}
                    colorOffset={() => look.colorOffset}
                    gap={() => look.gap}
                    drawBack={() => look.drawBack}
                    pickedTile={() => tiling.pickedTile}
                    picturesAsked={() => picturesAsked}
                    onMoved={scope.moveCentre}
                    onZoomed={scope.zoomAbout}
                    onTurned={scope.turnAbout}
                    onTilePicked={pickTileAt}
                />
                <button
                    type="button"
                    class="tiling-show"
                    visible={() => !isPanelShown}
                    text="Controls"
                    title="Show the controls (H)"
                    onClick={togglePanel}
                />
            </div>
            <div class="tiling-panel-frame" visible={() => isPanelShown}>
                <TilingPanelView
                    symmetry={() => tiling.symmetry}
                    shift={() => tiling.shift}
                    gridReveal={() => look.gridReveal}
                    drawBack={() => look.drawBack}
                    radius={() => scope.radius}
                    rotation={() => scope.rotation}
                    palette={() => look.palette}
                    colorMode={() => look.colorMode}
                    colorOffset={() => look.colorOffset}
                    morphSpeed={() => tiling.morphSpeed}
                    flowSpeed={() => look.flowSpeed}
                    isDrifting={() => tiling.isDrifting}
                    onSymmetrySlid={(symmetry) => { tiling.symmetry = symmetry; }}
                    onShiftSlid={(shift) => { tiling.shift = shift; }}
                    onGridRevealSlid={(reveal) => { look.gridReveal = reveal; }}
                    onRadiusSlid={(radius) => { scope.radius = radius; }}
                    onRotationSlid={(rotation) => { scope.rotation = rotation; }}
                    onPaletteChosen={(palette) => { look.palette = palette; }}
                    onColorModeChosen={(colorMode) => { look.colorMode = colorMode; }}
                    onColorOffsetSlid={(offset) => { look.colorOffset = offset; }}
                    onMorphSpeedSlid={(speed) => { tiling.morphSpeed = speed; }}
                    onFlowSpeedSlid={(speed) => { look.flowSpeed = speed; }}
                    onGridsPressed={look.toggleGrids}
                    onDriftPressed={toggleDrift}
                    onSurprisePressed={surprise}
                    onResetPressed={scope.reset}
                    onPicturePressed={askForPicture}
                    onHidePressed={togglePanel}
                />
            </div>
        </div>
    );

    /** Picks the tile drawn at the point (`x`, `y`) of the tiling, or lets it go if it was picked already. */
    function pickTileAt(x: number, y: number): void {
        const tile = look.findDrawnTile(x, y);
        tiling.pickTile(tile === tiling.pickedTile ? -1 : tile);
    }

    function toggleDrift(): void {
        tiling.isDrifting = !tiling.isDrifting;
    }

    function stepSymmetry(by: number): void {
        const index = SYMMETRIES.indexOf(tiling.symmetry) + by;
        tiling.symmetry = SYMMETRIES[Math.max(0, Math.min(SYMMETRIES.length - 1, index))];
    }

    function stepPalette(by: number): void {
        look.palette = stepRound(PALETTE_NAMES, look.palette, by);
    }

    function stepColorMode(by: number): void {
        look.colorMode = stepRound(COLOR_MODES, look.colorMode, by);
    }

    function surprise(): void {
        tiling.pickRandomTiling();
        look.pickRandomLook();
    }

    function togglePanel(): void {
        isPanelShown = !isPanelShown;
    }

    function askForPicture(): void {
        picturesAsked++;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The value `by` places on from `current` in `values`, going round from one end to the other. */
function stepRound<T>(values: readonly T[], current: T, by: number): T {
    return values[(values.indexOf(current) + by + values.length) % values.length];
}
