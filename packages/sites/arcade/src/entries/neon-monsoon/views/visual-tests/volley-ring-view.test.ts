import { canvasTest } from 'v-snap';
import { VolleyRingView } from '../volley-ring-view';

const SIZE = { width: 64, height: 64 };

canvasTest('full', SIZE, () => poseRing(0));
canvasTest('with shots lost', SIZE, () => poseRing(4));
canvasTest('stopping a bullet', SIZE, () => poseRing(1, 60));

/** The ring around a ship in the middle, with `shotsLost` of its shots gone, and a spark `msSinceHit` after a bullet was stopped. */
function poseRing(shotsLost: number, msSinceHit = Infinity) {
    return VolleyRingView({
        isShown: () => true,
        x: () => 32,
        y: () => 32,
        radius: () => 16,
        angle: () => 0.3,
        shotCount: 12,
        hasShotAt: (i) => i >= shotsLost,
        hitX: () => 46,
        hitY: () => 24,
        msSinceHit: () => msSinceHit,
    });
}
