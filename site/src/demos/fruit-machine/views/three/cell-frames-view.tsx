/** @jsxImportSource @mvtjs/three */
import { CanvasTexture, MeshBasicMaterial, type Object3D, PlaneGeometry, SRGBColorSpace } from 'three';
import { DRUM_AXIS_Y, DRUM_COUNT, DRUM_RADIUS, DRUM_WIDTH, drumX, FRONT_Z } from './bandit-layout';
import type { MaterialKit } from './material-kit';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CellFramesViewBindings {
    readonly kit: MaterialKit;
    /** Fixed: how many symbols round each drum, which sets how tall a cell looks. */
    readonly symbolsPerDrum: number;
    readonly rowCount: number;
    readonly isLitAt: (reel: number, row: number) => boolean;
    /** How far through the celebration's step, from 0 to 1, for the pulse. */
    readonly progress: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Gold frames, just behind the glass, round the cells the celebration is showing. */
export function CellFramesView(bindings: CellFramesViewBindings): Object3D {
    const { kit, symbolsPerDrum, rowCount } = bindings;
    const cellHeight = DRUM_RADIUS * Math.sin((Math.PI * 2) / symbolsPerDrum);
    const texture = kit.own(new CanvasTexture(drawFrame()));
    texture.colorSpace = SRGBColorSpace;
    const material = kit.own(new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    const geometry = kit.own(new PlaneGeometry(DRUM_WIDTH + 0.06, cellHeight));
    const cells: { reel: number; row: number }[] = [];
    for (let reel = 0; reel < DRUM_COUNT; reel++) {
        for (let row = 0; row < rowCount; row++) cells.push({ reel, row });
    }

    return (
        <group>
            {cells.map(({ reel, row }) => (
                <mesh
                    geometry={geometry}
                    material={material}
                    x={drumX(reel)}
                    y={DRUM_AXIS_Y + ((rowCount - 1) / 2 - row) * cellHeight}
                    z={FRONT_Z - 0.15}
                    visible={() => bindings.isLitAt(reel, row)}
                    scale={() => 1 + 0.06 * Math.sin(bindings.progress() * Math.PI * 2)}
                />
            ))}
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawFrame(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d')!;
    context.strokeStyle = '#ffd23f';
    context.lineWidth = 14;
    context.beginPath();
    context.roundRect(10, 10, 108, 108, 18);
    context.stroke();
    return canvas;
}
