/** @jsxImportSource @mvtjs/three/jsx */
import {
    BoxGeometry, CanvasTexture, CylinderGeometry, MeshBasicMaterial, type Object3D, PlaneGeometry, SphereGeometry,
    SRGBColorSpace,
} from 'three';
import { ACCENT_PAINT, BODY_TOP, CHROME, DISPLAY_FACE, DISPLAY_TEXT, FRONT_Z, LAMP } from './bandit-layout';
import type { MaterialKit } from './material-kit';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TopBoxViewBindings {
    readonly kit: MaterialKit;
    readonly isGameOver: () => boolean;
    /** How brightly the lamp on top glows, from 0 to 1. */
    readonly lampGlow: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The box on top of the cabinet: a sign with the machine's name, which says
 * GAME OVER at the end, and a lamp that flashes through a celebration.
 */
export function TopBoxView(bindings: TopBoxViewBindings): Object3D {
    const { kit } = bindings;
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 128;
    const signTexture = kit.own(new CanvasTexture(signCanvas));
    signTexture.colorSpace = SRGBColorSpace;
    let signIsGameOver: boolean | undefined;
    const lampMaterial = kit.glowing(LAMP);
    const boxZ = FRONT_Z - BOX_DEPTH / 2 - 0.1;

    return (
        <group y={BODY_TOP}>
            <mesh geometry={kit.own(new BoxGeometry(5.2, BOX_HEIGHT, BOX_DEPTH))} material={kit.paint(ACCENT_PAINT)} y={BOX_HEIGHT / 2} z={boxZ} />
            <mesh geometry={kit.own(new BoxGeometry(5.3, 0.14, BOX_DEPTH + 0.1))} material={kit.metal(CHROME)} y={BOX_HEIGHT} z={boxZ} />
            <mesh
                geometry={kit.own(new PlaneGeometry(4.6, 1.15))}
                material={kit.own(new MeshBasicMaterial({ map: signTexture }))}
                y={BOX_HEIGHT / 2}
                z={boxZ + BOX_DEPTH / 2 + 0.01}
                onRefresh={refreshSign}
            />
            <mesh geometry={kit.own(new CylinderGeometry(0.42, 0.5, 0.2, 32))} material={kit.metal(CHROME)} y={BOX_HEIGHT + 0.17} z={boxZ} />
            <mesh
                geometry={kit.own(new SphereGeometry(0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2))}
                material={lampMaterial}
                y={BOX_HEIGHT + 0.26}
                z={boxZ}
                onRefresh={refreshLamp}
            />
        </group>
    );

    /** Painted again only when the game ends. */
    function refreshSign(): void {
        const isGameOver = bindings.isGameOver();
        if (isGameOver === signIsGameOver) return;
        signIsGameOver = isGameOver;
        const context = signCanvas.getContext('2d')!;
        context.fillStyle = DISPLAY_FACE;
        context.fillRect(0, 0, signCanvas.width, signCanvas.height);
        context.fillStyle = isGameOver ? '#ff5468' : DISPLAY_TEXT;
        const text = isGameOver ? 'GAME OVER' : 'FRUIT MACHINE';
        // As big as fits: fonts differ in width from one system to the next
        context.font = SIGN_FONT;
        const fit = Math.min(1, (signCanvas.width * 0.88) / context.measureText(text).width);
        context.font = SIGN_FONT.replace('64px', `${Math.floor(64 * fit)}px`);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, signCanvas.width / 2, signCanvas.height / 2 + 4);
        signTexture.needsUpdate = true;
    }

    function refreshLamp(): void {
        lampMaterial.emissiveIntensity = bindings.lampGlow() * 1.6;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BOX_HEIGHT = 1.4;
const SIGN_FONT = '900 64px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const BOX_DEPTH = 3;
