// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Which light is lit. */
export type LightPhase = 'red' | 'yellow' | 'green';

/**
 * A traffic light that cycles through its phases on a timer: green for 3
 * seconds, yellow for 1, then red for 3, and round again.
 */
export interface TrafficLightModel {
    readonly phase: LightPhase;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a traffic light that starts on green. */
export function createTrafficLightModel(): TrafficLightModel {
    let phaseIndex = 0;
    let phase = ORDER[phaseIndex];
    // How long the light has been in this phase, in ms
    let elapsedMs = 0;

    const model: TrafficLightModel = {
        get phase() { return phase; },

        update(deltaMs) {
            elapsedMs += deltaMs;
            if (elapsedMs >= DURATIONS_MS[phase]) {
                elapsedMs -= DURATIONS_MS[phase];
                phaseIndex = (phaseIndex + 1) % ORDER.length;
                phase = ORDER[phaseIndex];
            }
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long each phase lasts, in ms. */
const DURATIONS_MS: Record<LightPhase, number> = {
    green: 3000,
    yellow: 1000,
    red: 3000,
};

/** The phases, in the order the light goes through them. */
const ORDER: readonly LightPhase[] = ['green', 'yellow', 'red'];
