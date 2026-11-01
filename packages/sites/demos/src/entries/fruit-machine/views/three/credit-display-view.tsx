/** @jsxImportSource @mvtjs/three */
import { CanvasTexture, MeshBasicMaterial, type Object3D, PlaneGeometry, SRGBColorSpace } from 'three';
import { formatCredits } from '../shared';
import { DISPLAY_FACE, DISPLAY_TEXT, FRONT_Z } from './bandit-layout';
import type { MaterialKit } from './material-kit';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CreditDisplayViewBindings {
    readonly kit: MaterialKit;
    /** Fixed: the bet never changes. */
    readonly bet: number;
    /** What the last spin paid back, which may be less than the bet: not always a win. */
    readonly paid: () => number;
    readonly y: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A little lit panel under the window showing the bet and what the last spin paid, repainted when the payout changes. */
export function CreditDisplayView(bindings: CreditDisplayViewBindings): Object3D {
    const { kit } = bindings;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const texture = kit.own(new CanvasTexture(canvas));
    texture.colorSpace = SRGBColorSpace;
    const betText = `BET ${formatCredits(bindings.bet)}`;
    let shownPaid = -1;

    return (
        <mesh
            geometry={kit.own(new PlaneGeometry(3.4, 0.425))}
            material={kit.own(new MeshBasicMaterial({ map: texture }))}
            y={bindings.y}
            z={FRONT_Z + 0.01}
            onRefresh={repaint}
        />
    );

    function repaint(): void {
        const paid = bindings.paid();
        if (paid === shownPaid) return;
        shownPaid = paid;
        const context = canvas.getContext('2d')!;
        context.fillStyle = DISPLAY_FACE;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = DISPLAY_TEXT;
        context.font = '800 34px ui-monospace, "Cascadia Mono", Consolas, monospace';
        context.textBaseline = 'middle';
        context.textAlign = 'left';
        context.fillText(betText, 18, canvas.height / 2 + 2);
        context.textAlign = 'right';
        context.fillText(`PAID ${formatCredits(paid)}`, canvas.width - 18, canvas.height / 2 + 2);
        texture.needsUpdate = true;
    }
}
