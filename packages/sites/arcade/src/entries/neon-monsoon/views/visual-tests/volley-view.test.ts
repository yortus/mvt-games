import { canvasTest } from 'v-snap';
import { VolleyView } from '../volley-view';

const SIZE = { width: 160, height: 200 };

canvasTest('spiralling out from the ring', SIZE, () => poseFlight(0.15));
canvasTest('hanging in a circle', SIZE, () => poseFlight(0.4));
canvasTest('speeding in on the target', SIZE, () => poseFlight(0.75));
// Shots the ring lost to bullets do not fly
canvasTest('with shots lost', SIZE, () => poseFlight(0.4, 5));

canvasTest('bursting', SIZE, () => VolleyView({
    isFlying: () => false,
    progress: () => 0,
    launchX: () => 80,
    launchY: () => 160,
    launchAngle: () => 0,
    launchRadius: () => 16,
    shotCount: SHOTS,
    hasShotAt: () => true,
    targetX: () => 110,
    targetY: () => 30,
    burstX: () => 110,
    burstY: () => 30,
    msSinceBurst: () => 100,
}));

/** The volley `progress` of the way through its flight, from a ring around a ship near the bottom to a target near the top. */
function poseFlight(progress: number, shotsLost = 0) {
    return VolleyView({
        isFlying: () => true,
        progress: () => progress,
        launchX: () => 80,
        launchY: () => 160,
        launchAngle: () => 0.3,
        launchRadius: () => 16,
        shotCount: SHOTS,
        hasShotAt: (i) => i >= shotsLost,
        targetX: () => 110,
        targetY: () => 30,
        burstX: () => 0,
        burstY: () => 0,
        msSinceBurst: () => Infinity,
    });
}

const SHOTS = 12;
