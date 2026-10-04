/** @jsxImportSource @mvtjs/three/jsx */
import { CanvasTexture, CylinderGeometry, type Object3D, SRGBColorSpace } from 'three';
import type { SymbolKind } from '../../data';
import { BASE, DRUM_AXIS_Y, DRUM_AXIS_Z, DRUM_RADIUS, DRUM_WIDTH, drumX } from './bandit-layout';
import type { MaterialKit } from './material-kit';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ReelDrumsViewBindings {
    readonly kit: MaterialKit;
    /** Fixed: one strip per drum. */
    readonly strips: readonly (readonly SymbolKind[])[];
    readonly canvasFor: (kind: SymbolKind) => HTMLCanvasElement;
    /** The strip position to show in the top row of the window, for each reel. */
    readonly positionAt: (reel: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The reels as drums, each wrapped in its strip, turning on one axis behind
 * the window. A reel's position is an angle here: one symbol is one
 * twenty-eighth of a turn, and the window shows the three facing front.
 */
export function ReelDrumsView(bindings: ReelDrumsViewBindings): Object3D {
    const { kit, strips, canvasFor } = bindings;
    // A cylinder stands on y; laid on its side, it turns about x
    const geometry = kit.own(new CylinderGeometry(DRUM_RADIUS, DRUM_RADIUS, DRUM_WIDTH, 96, 1).rotateZ(Math.PI / 2));
    const capMaterial = kit.matte(BASE);

    return (
        <group y={DRUM_AXIS_Y} z={DRUM_AXIS_Z}>
            {strips.map((strip, reel) => {
                const texture = kit.own(new CanvasTexture(drawDrum(strip, canvasFor)));
                texture.colorSpace = SRGBColorSpace;
                texture.anisotropy = 4;
                return (
                    <mesh
                        geometry={geometry}
                        material={[kit.printed(texture), capMaterial, capMaterial]}
                        x={drumX(reel)}
                        rotationX={() => drumAngle(strip.length, bindings.positionAt(reel))}
                    />
                );
            })}
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Pixels per symbol in a drum's texture: 28 symbols make 3584, under every GPU's limit. */
const CELL_PIXELS = 128;
const SYMBOL_FILL = 0.84;
const DRUM_FACE = '#fff7ea';

/**
 * The turn that brings a strip position to the window's top row. Strip
 * position `i` is painted at angle `-(i + 0.5)` symbols round the drum, so
 * the middle row, `position + 1`, faces front when the drum is turned by the
 * same; a falling position turns it on, and the symbols travel down.
 */
function drumAngle(symbolCount: number, position: number): number {
    return (-(position + 1.5) * Math.PI * 2) / symbolCount;
}

/**
 * A strip, painted to wrap a drum lying on its side. Round the drum is the
 * texture's x, and across it the texture's y, so each picture is drawn turned
 * a quarter turn, and the strip runs right to left: the first symbol at the
 * right-hand end.
 */
function drawDrum(strip: readonly SymbolKind[], canvasFor: (kind: SymbolKind) => HTMLCanvasElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = CELL_PIXELS * strip.length;
    canvas.height = CELL_PIXELS;
    const context = canvas.getContext('2d')!;
    context.fillStyle = DRUM_FACE;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const size = CELL_PIXELS * SYMBOL_FILL;
    for (let i = 0; i < strip.length; i++) {
        context.save();
        context.translate((strip.length - 1 - i + 0.5) * CELL_PIXELS, CELL_PIXELS / 2);
        context.rotate(Math.PI / 2);
        context.drawImage(canvasFor(strip[i]), -size / 2, -size / 2, size, size);
        context.restore();
    }
    return canvas;
}
