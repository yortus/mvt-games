/** @jsxImportSource @mvtjs/three */
import { CylinderGeometry, type Object3D, SphereGeometry } from 'three';
import { easeOutBack } from '../shared';
import { BASE, CHROME, LEVER_BALL, LEVER_BRACKET, LEVER_LENGTH, LEVER_X, LEVER_Y, LEVER_Z } from './bandit-layout';
import type { MaterialKit } from './material-kit';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LeverViewBindings {
    readonly kit: MaterialKit;
    /** Counts spins: each new spin pulls the lever, whichever view started it. */
    readonly spinCount: () => number;
    /** The user tapped the lever. */
    readonly onPulled?: () => void;
    /** The pointer moved onto (true) or off (false) the lever. */
    readonly onHoverChanged?: (isHovered: boolean) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The one arm of the one-armed bandit. It swings down and springs back each
 * time a spin starts, so pressing SPIN in another quadrant pulls it too. The
 * swing is presentation state: started when the spin count changes, advanced
 * in `update`.
 */
export function LeverView(bindings: LeverViewBindings): Object3D {
    const { kit } = bindings;
    let pulledSpin = bindings.spinCount();
    // Starts at rest: the swing is over
    let swingMs = SWING_MS;

    return (
        <group
            x={LEVER_X}
            y={LEVER_Y}
            z={LEVER_Z}
            rotationX={leverAngle}
            onUpdate={advance}
            onClick={() => bindings.onPulled?.()}
            onPointerOver={() => bindings.onHoverChanged?.(true)}
            onPointerOut={() => bindings.onHoverChanged?.(false)}
        >
            <mesh
                geometry={kit.own(new CylinderGeometry(0.16, 0.22, LEVER_BRACKET, 24).rotateZ(Math.PI / 2))}
                material={kit.metal(CHROME)}
                x={-LEVER_BRACKET / 2}
            />
            <mesh geometry={kit.own(new CylinderGeometry(0.3, 0.3, 0.3, 32).rotateZ(Math.PI / 2))} material={kit.matte(BASE)} />
            <mesh geometry={kit.own(new CylinderGeometry(0.08, 0.1, LEVER_LENGTH, 16))} material={kit.metal(CHROME)} y={LEVER_LENGTH / 2} />
            <mesh geometry={kit.own(new SphereGeometry(0.36, 32, 16))} material={kit.paint(LEVER_BALL)} y={LEVER_LENGTH} />
        </group>
    );

    function advance(deltaMs: number): void {
        const spinCount = bindings.spinCount();
        if (spinCount !== pulledSpin) {
            pulledSpin = spinCount;
            swingMs = 0;
        }
        swingMs = Math.min(SWING_MS, swingMs + deltaMs);
    }

    /** Down fast, then back up with a spring. */
    function leverAngle(): number {
        const t = swingMs / SWING_MS;
        if (t < DOWN_SHARE) {
            const down = t / DOWN_SHARE;
            return REST_ANGLE + (PULLED_ANGLE - REST_ANGLE) * (1 - (1 - down) * (1 - down));
        }
        return PULLED_ANGLE + (REST_ANGLE - PULLED_ANGLE) * easeOutBack((t - DOWN_SHARE) / (1 - DOWN_SHARE));
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SWING_MS = 700;
/** The share of the swing spent going down. */
const DOWN_SHARE = 0.3;
/** Upright, tipped a little back. */
const REST_ANGLE = -0.12;
/** Pulled forward and down towards the player. */
const PULLED_ANGLE = 1.25;
