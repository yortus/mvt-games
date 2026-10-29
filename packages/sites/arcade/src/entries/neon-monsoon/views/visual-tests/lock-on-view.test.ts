import { canvasTest } from 'v-snap';
import { LockOnView } from '../lock-on-view';

const SIZE = { width: 120, height: 160 };

canvasTest('setting out from the ship', SIZE, () => poseLock(0.15));
canvasTest('closing on the target', SIZE, () => poseLock(0.7));
canvasTest('locked', SIZE, () => poseLock(1));
// Once locked, the crosshairs blink between white and cyan
canvasTest('locked, blinking', SIZE, () => poseLock(1, 4));

/** The crosshairs `progress` of the way through a lock, from a ship at the bottom onto a barge near the top. */
function poseLock(progress: number, stepCount = 0) {
    return LockOnView({
        isShown: () => true,
        progress: () => progress,
        fromX: () => 60,
        fromY: () => 140,
        x: () => 80,
        y: () => 40,
        targetRadius: () => 18,
        stepCount: () => stepCount,
    });
}
