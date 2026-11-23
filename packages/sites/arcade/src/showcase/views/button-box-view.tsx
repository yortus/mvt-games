/** @jsxImportSource @mvtjs/pixi-3d */

import { type Container3D, CubeGeometry, CylinderGeometry, FlatMaterial, Material3D, PlaneGeometry } from '@pixi/3d';
import { Texture } from 'pixi.js';
import { BUTTON_BOX_DEPTH, BUTTON_BOX_HEIGHT, BUTTON_BOX_WIDTH } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ButtonBoxViewBindings {
    /** Where the box stands, in metres, and the way its front faces. */
    readonly x: number;
    readonly z: number;
    readonly facing: number;
    /** Whether the button is pressed down. */
    readonly isPressed: () => boolean;
    /** The visitor clicked or tapped the button. */
    readonly onPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A plain grey box, about waist high, with one big red button on its sloping
 * top. A label on its front says where the button leads. The visitor can
 * click or tap the button itself, as most people try first. The press
 * stops there, so it doesn't turn the view as well.
 */
export function ButtonBoxView({ x, z, facing, isPressed, onPressed }: ButtonBoxViewBindings): Container3D {
    const grey = new Material3D({ baseColor: 0x6a6c74, roughness: 0.7 });
    const red = new Material3D({ baseColor: 0xd8202c, roughness: 0.35 });
    const box = new CubeGeometry({ width: BUTTON_BOX_WIDTH, height: BUTTON_BOX_HEIGHT, depth: BUTTON_BOX_DEPTH });
    const button = new CylinderGeometry({ radiusTop: BUTTON_RADIUS, radiusBottom: BUTTON_RADIUS, height: BUTTON_HEIGHT });
    const labelPlane = new PlaneGeometry({ width: LABEL_WIDTH, height: LABEL_WIDTH / 2, flipV: true });
    const labelTexture = createLabelTexture();
    const label = new FlatMaterial({ baseColorTexture: labelTexture });
    const front = BUTTON_BOX_DEPTH / 2;
    return (
        // Built facing +z, then turned to face the way it faces in the hall
        <group owns={[grey, red, box, button, labelPlane, labelTexture, label]} x={x} z={z} rotationY={Math.PI / 2 - facing}>
            <mesh geometry={box} material={grey} y={BUTTON_BOX_HEIGHT / 2} />
            {/* The top leans toward whoever stands in front */}
            <group y={BUTTON_BOX_HEIGHT} rotationX={TOP_SLOPE}>
                <mesh
                    geometry={button}
                    material={red}
                    y={() => (isPressed() ? BUTTON_HEIGHT * 0.1 : BUTTON_HEIGHT / 2)}
                    cursor="pointer"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        onPressed?.();
                    }}
                />
            </group>
            <mesh geometry={labelPlane} material={label} y={BUTTON_BOX_HEIGHT * 0.7} z={front + 0.002} />
        </group>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TOP_SLOPE = 0.25;
const BUTTON_RADIUS = 0.17;
const BUTTON_HEIGHT = 0.08;
const LABEL_WIDTH = 0.5;
const LABEL_TEXTURE_WIDTH = 512;
const LABEL_TEXTURE_HEIGHT = 256;

/** The label, in two lines of dark capitals on a cream plate. */
function createLabelTexture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = LABEL_TEXTURE_WIDTH;
    canvas.height = LABEL_TEXTURE_HEIGHT;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('arcade hall: a label needs a 2D canvas');
    context.fillStyle = '#efe6cf';
    context.fillRect(0, 0, LABEL_TEXTURE_WIDTH, LABEL_TEXTURE_HEIGHT);
    context.strokeStyle = '#2a2a30';
    context.lineWidth = 10;
    context.strokeRect(10, 10, LABEL_TEXTURE_WIDTH - 20, LABEL_TEXTURE_HEIGHT - 20);
    context.fillStyle = '#2a2a30';
    context.font = '900 62px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const lines = ['GO OUTSIDE', 'AND PLAY'];
    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], LABEL_TEXTURE_WIDTH / 2, LABEL_TEXTURE_HEIGHT / 2 + (i - 0.5) * 78);
    }
    return Texture.from(canvas);
}
