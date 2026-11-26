import type { KnobValue, PoseInfo } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The knobs you've changed on the pose being previewed, by their index. */
export interface ActiveKnobs {
    readonly poseId: string;
    readonly values: ReadonlyMap<number, KnobValue>;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns a knob's value. That's the one you set, if its pose is being
 * previewed and you changed it. Otherwise it's the literal from the test
 * file. Every literal in an instrumented pose is a call to this.
 */
export function readKnob<T extends KnobValue>(poseId: string, index: number, value: T): T {
    const active = state.active;
    if (active === undefined || active.poseId !== poseId) return value;
    return (active.values.get(index) ?? value) as T;
}

/** Notes a pose's knobs, and returns the pose. Every instrumented pose is wrapped in a call to this. */
export function markPose<P extends object>(info: PoseInfo, pose: P): P {
    poseInfos.set(pose, info);
    return pose;
}

/** Returns the knobs of a pose that `markPose` noted, or `undefined` for a pose that wasn't written in place. */
export function findPoseInfo(pose: object): PoseInfo | undefined {
    return poseInfos.get(pose);
}

/** Sets which pose is being previewed, and the knobs you've changed on it. */
export function setActiveKnobs(active: ActiveKnobs | undefined): void {
    state.active = active;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const poseInfos = new WeakMap<object, PoseInfo>();

const state: { active: ActiveKnobs | undefined } = { active: undefined };
