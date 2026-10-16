import { Container, Graphics } from 'pixi.js';
import type { DefeatVariant, Facing, FighterPhase, MoveKind } from '../data';
import { ARENA_WIDTH, MOVE_DATA, TURN_POSE_SEQUENCE } from '../data';
import { SCREEN_WIDTH, GROUND_Y_PX } from './view-constants';
import { FIGHTER_POSES, type Limb, type Pose } from './fighter-poses';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FighterViewBindings {
    x: () => number;
    height: () => number;
    facing: () => Facing;
    phase: () => FighterPhase;
    move: () => MoveKind | undefined;
    progress: () => number;
    defeatVariant: () => DefeatVariant;
    /** Colour of the fighter's belt and headband. Read once. */
    accentColor: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A fighter drawn from a pose: a jointed figure in a white gi, with a
 * coloured belt and headband. The pose is chosen from the model's phase and
 * progress each frame, and the figure is redrawn only when the pose changes.
 */
export function FighterView(bindings: FighterViewBindings): Container {
    const scale = SCREEN_WIDTH / ARENA_WIDTH;
    const { accentColor } = bindings;
    const poses = FIGHTER_POSES;

    // Move kind to pose array lookup (shared references, no per-tick alloc)
    const movePoseMap: Record<MoveKind, readonly Pose[]> = {
        'high-punch': poses.punch,
        'back-lunge-punch': poses.punch,
        'high-kick': poses.kick,
        'mid-kick': poses.kick,
        'low-kick': poses.kick,
        'back-low-kick': poses.kick,
        'foot-sweep': poses.footSweep,
        'crouch-punch': poses.crouchPunch,
        'back-crouch-punch': poses.crouchPunch,
        'roundhouse': poses.roundhouse,
        'flying-kick': poses.flyingKick,
        'front-somersault': poses.frontSomersault,
        'back-somersault': poses.backSomersault,
        'jump': poses.jump,
    };

    const view = new Container();
    view.label = 'fighter';
    const gfx = new Graphics();
    view.addChild(gfx);

    // Joint positions for the pose being drawn, reused for every pose
    const joints = new Float64Array(JOINT_COUNT * 2);
    let drawnPose: Pose | undefined;

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        // Position
        const x = bindings.x() * scale;
        const heightPx = bindings.height() * scale;
        view.position.set(x, GROUND_Y_PX - heightPx);

        // Facing: the figure is drawn facing right; flip for left
        view.scale.x = bindings.facing() === 'left' ? -1 : 1;

        // Pose (derived from phase + progress every frame)
        const pose = resolvePose();
        if (pose !== drawnPose) {
            drawnPose = pose;
            drawFighter(pose);
        }
    }

    // -----------------------------------------------------------------------
    // Pose resolution
    // -----------------------------------------------------------------------

    function resolvePose(): Pose {
        const phase = bindings.phase();
        const progress = bindings.progress();

        // prettier-ignore
        switch (phase) {
            case 'idle':         return poses.guard;
            case 'walking':      return poses.walk[progressToIndex(progress, poses.walk.length)];
            case 'turning':      return resolveTurnPose(progress);
            case 'blocking':     return poses.block[progressToIndex(progress, poses.block.length)];
            case 'hit-reacting': return poses.hit;
            case 'defeated':     return resolveDefeatPose(progress);
            case 'won':          return resolveWonPose(progress);
            case 'lost':         return poses.lost[0];
            case 'attacking':
            case 'airborne':     return resolveMovePose(progress);
            default:             return poses.guard;
        }
    }

    function resolveTurnPose(progress: number): Pose {
        const segIdx = progressToIndex(progress, TURN_POSE_SEQUENCE.length);
        return poses.turn[TURN_POSE_SEQUENCE[segIdx]] ?? poses.guard;
    }

    function resolveWonPose(progress: number): Pose {
        // 4 toggles over the duration: frame 0, 1, 0, 1
        const toggle = progressToIndex(progress, 4);
        return poses.won[toggle % 2];
    }

    function resolveDefeatPose(progress: number): Pose {
        const frames = poses.defeat[bindings.defeatVariant()];
        return frames[progressToIndex(progress, frames.length)];
    }

    function resolveMovePose(progress: number): Pose {
        const move = bindings.move();
        if (!move) return poses.guard;

        const frames = movePoseMap[move];
        const md = MOVE_DATA[move];
        const segIdx = progressToIndex(progress, md.frameSequence.length);
        return frames[md.frameSequence[segIdx]] ?? frames[0];
    }

    // -----------------------------------------------------------------------
    // Drawing
    // -----------------------------------------------------------------------

    function drawFighter(pose: Pose): void {
        placeJoints(pose, joints);
        gfx.clear();

        // Back limbs first, in the shaded gi, then the body, then the front limbs
        drawLimb(NECK, B_ELBOW, B_HAND, ARM_WIDTH, GI_SHADE_COLOR);
        drawLimb(HIP, B_KNEE, B_FOOT, LEG_WIDTH, GI_SHADE_COLOR);
        drawSegment(HIP, NECK, TORSO_WIDTH, GI_COLOR);
        drawBelt();
        drawLimb(HIP, F_KNEE, F_FOOT, LEG_WIDTH, GI_COLOR);
        drawHead(pose.spin ?? 0);
        drawLimb(NECK, F_ELBOW, F_HAND, ARM_WIDTH, GI_COLOR);
    }

    /** An upper and lower segment, with a hand or foot at the end. */
    function drawLimb(a: number, b: number, c: number, width: number, color: number): void {
        gfx.moveTo(jx(a), jy(a)).lineTo(jx(b), jy(b)).lineTo(jx(c), jy(c))
            .stroke({ width: width + OUTLINE * 2, color: OUTLINE_COLOR, cap: 'round', join: 'round' })
            .moveTo(jx(a), jy(a)).lineTo(jx(b), jy(b)).lineTo(jx(c), jy(c))
            .stroke({ width, color, cap: 'round', join: 'round' });
        gfx.circle(jx(c), jy(c), EXTREMITY_RADIUS).fill(SKIN_COLOR);
    }

    function drawSegment(a: number, b: number, width: number, color: number): void {
        gfx.moveTo(jx(a), jy(a)).lineTo(jx(b), jy(b))
            .stroke({ width: width + OUTLINE * 2, color: OUTLINE_COLOR, cap: 'round' })
            .moveTo(jx(a), jy(a)).lineTo(jx(b), jy(b))
            .stroke({ width, color, cap: 'round' });
    }

    /** A band across the torso just above the hip. */
    function drawBelt(): void {
        const dx = jx(NECK) - jx(HIP);
        const dy = jy(NECK) - jy(HIP);
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;
        const cx = jx(HIP) + ux * BELT_RISE;
        const cy = jy(HIP) + uy * BELT_RISE;
        const half = TORSO_WIDTH / 2;
        gfx.moveTo(cx - uy * half, cy + ux * half).lineTo(cx + uy * half, cy - ux * half)
            .stroke({ width: BELT_WIDTH, color: accentColor });
    }

    /** The head, with hair at the back and a headband whose tails fly behind. */
    function drawHead(spin: number): void {
        const hx = jx(HEAD);
        const hy = jy(HEAD);
        const cos = Math.cos(spin * DEG);
        const sin = Math.sin(spin * DEG);
        gfx.circle(hx, hy, HEAD_RADIUS + OUTLINE).fill(OUTLINE_COLOR);
        gfx.circle(hx, hy, HEAD_RADIUS).fill(HAIR_COLOR);
        gfx.circle(hx + rx(1.2, 0.6, cos, sin), hy + ry(1.2, 0.6, cos, sin), HEAD_RADIUS - 1.2).fill(SKIN_COLOR);
        gfx.moveTo(hx + rx(-HEAD_RADIUS, -1.5, cos, sin), hy + ry(-HEAD_RADIUS, -1.5, cos, sin))
            .lineTo(hx + rx(HEAD_RADIUS, -1.5, cos, sin), hy + ry(HEAD_RADIUS, -1.5, cos, sin))
            .stroke({ width: 1.8, color: accentColor })
            .moveTo(hx + rx(-HEAD_RADIUS, -1.5, cos, sin), hy + ry(-HEAD_RADIUS, -1.5, cos, sin))
            .lineTo(hx + rx(-HEAD_RADIUS - 4, 1, cos, sin), hy + ry(-HEAD_RADIUS - 4, 1, cos, sin))
            .stroke({ width: 1.4, color: accentColor, cap: 'round' });
    }

    function jx(joint: number): number {
        return joints[joint * 2];
    }

    function jy(joint: number): number {
        return joints[joint * 2 + 1];
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// Joint indices into the joint position array
const HIP = 0;
const NECK = 1;
const HEAD = 2;
const F_ELBOW = 3;
const F_HAND = 4;
const B_ELBOW = 5;
const B_HAND = 6;
const F_KNEE = 7;
const F_FOOT = 8;
const B_KNEE = 9;
const B_FOOT = 10;
const JOINT_COUNT = 11;

// Body proportions, in pixels: about 40 tall standing
const TORSO = 12;
const NECK_TO_HEAD = 5;
const UPPER_ARM = 7;
const FOREARM = 7;
const THIGH = 9;
const SHIN = 9;
const HEAD_RADIUS = 4.5;

// Stroke widths, in pixels
const TORSO_WIDTH = 7;
const ARM_WIDTH = 3.5;
const LEG_WIDTH = 4.5;
const OUTLINE = 1;
const EXTREMITY_RADIUS = 1.9;
const BELT_WIDTH = 2.5;
const BELT_RISE = 2.5;

/** Where the lowest point of the figure rests, below the view's origin. */
const FOOT_Y = 7;

const GI_COLOR = 0xf4f2ea;
const GI_SHADE_COLOR = 0xc9c6bc;
const SKIN_COLOR = 0xe2b48a;
const HAIR_COLOR = 0x2b1d14;
const OUTLINE_COLOR = 0x1c1c22;

const DEG = Math.PI / 180;

/**
 * Place every joint for a pose, in place: build the figure from the hip, spin
 * it about the middle of the torso, then lift or drop it so that its lowest
 * point rests at FOOT_Y.
 */
function placeJoints(pose: Pose, out: Float64Array): void {
    setJoint(out, HIP, 0, 0);
    const t = pose.torso * DEG;
    setJoint(out, NECK, Math.sin(t) * TORSO, -Math.cos(t) * TORSO);
    setJoint(out, HEAD, out[NECK * 2] + Math.sin(t) * NECK_TO_HEAD, out[NECK * 2 + 1] - Math.cos(t) * NECK_TO_HEAD);
    placeLimb(out, NECK, F_ELBOW, F_HAND, pose.frontArm, UPPER_ARM, FOREARM);
    placeLimb(out, NECK, B_ELBOW, B_HAND, pose.backArm, UPPER_ARM, FOREARM);
    placeLimb(out, HIP, F_KNEE, F_FOOT, pose.frontLeg, THIGH, SHIN);
    placeLimb(out, HIP, B_KNEE, B_FOOT, pose.backLeg, THIGH, SHIN);

    const spin = (pose.spin ?? 0) * DEG;
    if (spin !== 0) {
        const cx = out[NECK * 2] / 2;
        const cy = out[NECK * 2 + 1] / 2;
        const cos = Math.cos(spin);
        const sin = Math.sin(spin);
        for (let j = 0; j < JOINT_COUNT; j++) {
            const x = out[j * 2] - cx;
            const y = out[j * 2 + 1] - cy;
            out[j * 2] = cx + x * cos - y * sin;
            out[j * 2 + 1] = cy + x * sin + y * cos;
        }
    }

    let lowest = out[HEAD * 2 + 1] + HEAD_RADIUS;
    for (let j = 0; j < JOINT_COUNT; j++) {
        if (j !== HEAD && out[j * 2 + 1] > lowest) lowest = out[j * 2 + 1];
    }
    const shift = FOOT_Y - lowest;
    for (let j = 0; j < JOINT_COUNT; j++) out[j * 2 + 1] += shift;
}

function placeLimb(out: Float64Array, root: number, mid: number, end: number, limb: Limb, upper: number, lower: number): void {
    const a = limb[0] * DEG;
    const b = limb[1] * DEG;
    setJoint(out, mid, out[root * 2] + Math.sin(a) * upper, out[root * 2 + 1] + Math.cos(a) * upper);
    setJoint(out, end, out[mid * 2] + Math.sin(b) * lower, out[mid * 2 + 1] + Math.cos(b) * lower);
}

function setJoint(out: Float64Array, joint: number, x: number, y: number): void {
    out[joint * 2] = x;
    out[joint * 2 + 1] = y;
}

/** The x of an offset (dx, dy) after rotating it by the angle with this cos and sin. */
function rx(dx: number, dy: number, cos: number, sin: number): number {
    return dx * cos - dy * sin;
}

/** The y of an offset (dx, dy) after rotating it by the angle with this cos and sin. */
function ry(dx: number, dy: number, cos: number, sin: number): number {
    return dx * sin + dy * cos;
}

/** Map a 0..1 progress to a 0-based index, clamped to [0, count-1]. */
function progressToIndex(progress: number, count: number): number {
    const i = Math.floor(progress * count);
    return i < 0 ? 0 : i >= count ? count - 1 : i;
}
