// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * One frame of a fighter's animation, as joint angles for a figure facing
 * right. Limb angles are in degrees from straight down, positive swinging
 * forward (toward the opponent): 0 hangs down, 90 points forward, 180 points
 * up, and negative angles swing backward.
 */
export interface Pose {
    /** Lean of the torso from upright, degrees, positive leaning forward. */
    readonly torso: number;
    /** Upper arm and forearm angles, nearer the viewer. */
    readonly frontArm: Limb;
    /** Upper arm and forearm angles, further from the viewer. */
    readonly backArm: Limb;
    /** Thigh and shin angles, nearer the viewer. */
    readonly frontLeg: Limb;
    /** Thigh and shin angles, further from the viewer. */
    readonly backLeg: Limb;
    /** Whole-body rotation in degrees, clockwise (head forward), for flips and falls. */
    readonly spin?: number;
}

export type Limb = readonly [upper: number, lower: number];

/**
 * The poses for each animation, indexed like the model's frame sequences
 * (`MoveData.frameSequence`, `TURN_POSE_SEQUENCE`), so each array is at
 * least as long as the highest index the model uses for it.
 */
export interface FighterPoses {
    readonly guard: Pose;
    readonly hit: Pose;
    readonly walk: readonly Pose[];
    readonly jump: readonly Pose[];
    readonly punch: readonly Pose[];
    readonly kick: readonly Pose[];
    readonly footSweep: readonly Pose[];
    readonly crouchPunch: readonly Pose[];
    readonly roundhouse: readonly Pose[];
    readonly flyingKick: readonly Pose[];
    readonly frontSomersault: readonly Pose[];
    readonly backSomersault: readonly Pose[];
    readonly turn: readonly Pose[];
    readonly block: readonly Pose[];
    readonly defeat: { readonly a: readonly Pose[]; readonly b: readonly Pose[]; readonly c: readonly Pose[]; readonly d: readonly Pose[] };
    readonly won: readonly Pose[];
    readonly lost: readonly Pose[];
}

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------

// Standing
const GUARD: Pose = { torso: 5, frontArm: [40, 140], backArm: [15, 125], frontLeg: [20, 0], backLeg: [-20, -5] };
const HIT: Pose = { torso: -18, frontArm: [10, 60], backArm: [-25, 30], frontLeg: [15, 5], backLeg: [-20, -10] };
const WALK_A: Pose = { torso: 6, frontArm: [35, 135], backArm: [20, 125], frontLeg: [28, 8], backLeg: [-25, -15] };
const WALK_B: Pose = { torso: 6, frontArm: [45, 145], backArm: [10, 120], frontLeg: [-5, -25], backLeg: [10, 5] };
const TURN: Pose = { torso: 0, frontArm: [5, 25], backArm: [-5, 20], frontLeg: [6, 0], backLeg: [-6, 0] };

// Punches
const PUNCH_READY: Pose = { torso: 10, frontArm: [20, 120], backArm: [30, 150], frontLeg: [30, 5], backLeg: [-28, -20] };
const HIGH_PUNCH: Pose = { torso: 15, frontArm: [100, 105], backArm: [-10, 140], frontLeg: [35, 5], backLeg: [-35, -30] };

// Kicks
const KICK_READY: Pose = { torso: -5, frontArm: [40, 140], backArm: [15, 120], frontLeg: [15, 0], backLeg: [-10, -5] };
const MID_CHAMBER: Pose = { torso: -12, frontArm: [45, 140], backArm: [-10, 100], frontLeg: [90, 0], backLeg: [0, 0] };
const MID_KICK: Pose = { torso: -22, frontArm: [50, 130], backArm: [-25, 80], frontLeg: [88, 92], backLeg: [-3, 0] };
const LOW_CHAMBER: Pose = { torso: -8, frontArm: [40, 140], backArm: [0, 110], frontLeg: [55, -10], backLeg: [0, 0] };
const LOW_KICK: Pose = { torso: -12, frontArm: [45, 135], backArm: [-15, 90], frontLeg: [60, 70], backLeg: [-3, 0] };
const HIGH_CHAMBER: Pose = { torso: -20, frontArm: [60, 150], backArm: [-20, 90], frontLeg: [120, 30], backLeg: [0, 0] };
const HIGH_KICK: Pose = { torso: -35, frontArm: [70, 140], backArm: [-40, 60], frontLeg: [135, 140], backLeg: [-5, 0] };

// Low attacks
const CROUCH: Pose = { torso: 15, frontArm: [45, 140], backArm: [15, 120], frontLeg: [75, -20], backLeg: [-35, -110] };
const CROUCH_PUNCH: Pose = { torso: 20, frontArm: [85, 88], backArm: [-15, 130], frontLeg: [75, -20], backLeg: [-35, -110] };
const SWEEP_DROP: Pose = { torso: 25, frontArm: [35, 70], backArm: [-15, 20], frontLeg: [70, -30], backLeg: [-40, -110] };
const SWEEP_SWING: Pose = { torso: 15, frontArm: [30, 60], backArm: [-25, -10], frontLeg: [80, 40], backLeg: [-30, -115] };
const SWEEP_FULL: Pose = { torso: 5, frontArm: [40, 80], backArm: [-35, -20], frontLeg: [88, 92], backLeg: [-15, -105] };

// Roundhouse: wind up, chamber, kick high and round, and recover
const RH_TURN: Pose = { torso: -15, frontArm: [70, 120], backArm: [-40, 40], frontLeg: [10, 0], backLeg: [-15, -5] };
const RH_CHAMBER: Pose = { torso: -25, frontArm: [80, 110], backArm: [-50, 30], frontLeg: [105, 20], backLeg: [0, 0] };
const RH_KICK: Pose = { torso: -40, frontArm: [90, 110], backArm: [-60, 20], frontLeg: [118, 118], backLeg: [-5, 0] };
const RH_RECOVER: Pose = { torso: -15, frontArm: [60, 130], backArm: [-20, 80], frontLeg: [70, 0], backLeg: [-5, 0] };

// Airborne
const TUCK: Pose = { torso: 10, frontArm: [60, 130], backArm: [30, 110], frontLeg: [95, -10], backLeg: [55, -60] };
const JUMP: Pose = { torso: 0, frontArm: [150, 165], backArm: [130, 160], frontLeg: [60, -20], backLeg: [30, -50] };
const FLY_CHAMBER: Pose = { torso: -10, frontArm: [50, 130], backArm: [-30, 60], frontLeg: [100, 15], backLeg: [-20, -110] };
const FLY_KICK: Pose = { torso: -15, frontArm: [40, 120], backArm: [-40, 0], frontLeg: [95, 95], backLeg: [-25, -115] };
const FLY_FULL: Pose = { torso: -18, frontArm: [35, 110], backArm: [-50, -20], frontLeg: [100, 100], backLeg: [-20, -120] };
const LAND: Pose = { torso: 15, frontArm: [50, 130], backArm: [20, 110], frontLeg: [60, -20], backLeg: [-30, -60] };

// Blocks
const BLOCK_RAISE: Pose = { torso: 0, frontArm: [80, 150], backArm: [15, 120], frontLeg: [18, 0], backLeg: [-22, -8] };
const BLOCK: Pose = { torso: -5, frontArm: [125, 205], backArm: [20, 125], frontLeg: [15, 0], backLeg: [-25, -10] };

// Defeats: knocked back, doubled over, crumpled, swept off the feet
const STAGGER_BACK: Pose = { torso: -30, frontArm: [60, 150], backArm: [-60, 40], frontLeg: [30, 10], backLeg: [-15, -5] };
const LYING: Pose = { torso: 0, frontArm: [170, 175], backArm: [150, 170], frontLeg: [5, 0], backLeg: [-5, 0] };
const DOUBLED: Pose = { torso: 50, frontArm: [30, 110], backArm: [20, 100], frontLeg: [15, 0], backLeg: [-15, 0] };
const KNEEL: Pose = { torso: 30, frontArm: [10, 20], backArm: [5, 10], frontLeg: [80, -10], backLeg: [-10, -100] };
const SLUMP: Pose = { torso: 70, frontArm: [60, 70], backArm: [50, 60], frontLeg: [85, -5], backLeg: [-5, -100] };
const SWEPT: Pose = { torso: -20, frontArm: [120, 160], backArm: [-80, -40], frontLeg: [70, 60], backLeg: [40, 30] };

// Endings
const WON_A: Pose = { torso: 0, frontArm: [165, 175], backArm: [160, 170], frontLeg: [8, 0], backLeg: [-8, 0] };
const WON_B: Pose = { torso: 0, frontArm: [100, 170], backArm: [5, 10], frontLeg: [8, 0], backLeg: [-8, 0] };
const LOST: Pose = { torso: 22, frontArm: [10, 5], backArm: [5, 0], frontLeg: [5, 0], backLeg: [-5, 0] };

export const FIGHTER_POSES: FighterPoses = {
    guard: GUARD,
    hit: HIT,
    walk: [GUARD, WALK_A, WALK_B],
    jump: [JUMP],
    punch: [PUNCH_READY, PUNCH_READY, HIGH_PUNCH],
    kick: [KICK_READY, MID_CHAMBER, MID_KICK, LOW_CHAMBER, LOW_KICK, HIGH_CHAMBER, HIGH_KICK],
    footSweep: [SWEEP_DROP, SWEEP_SWING, SWEEP_FULL, SWEEP_DROP],
    crouchPunch: [CROUCH, CROUCH_PUNCH],
    roundhouse: [RH_TURN, RH_CHAMBER, RH_KICK, RH_RECOVER],
    flyingKick: [TUCK, TUCK, FLY_CHAMBER, FLY_KICK, FLY_FULL],
    frontSomersault: [CROUCH, spun(TUCK, 72), spun(TUCK, 144), spun(TUCK, 216), spun(TUCK, 288), LAND],
    backSomersault: [CROUCH, spun(TUCK, -72), spun(TUCK, -144), spun(TUCK, -216), spun(TUCK, -288), LAND],
    turn: [TURN],
    block: [BLOCK_RAISE, BLOCK, BLOCK],
    defeat: {
        a: [STAGGER_BACK, spun(STAGGER_BACK, -45), spun(LYING, -90)],
        b: [DOUBLED, spun(DOUBLED, 40), spun(LYING, 90)],
        c: [KNEEL, SLUMP, spun(LYING, 90)],
        d: [spun(SWEPT, -30), spun(SWEPT, -70), spun(LYING, -90)],
    },
    won: [WON_A, WON_B],
    lost: [LOST],
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function spun(pose: Pose, spin: number): Pose {
    return { ...pose, spin };
}
