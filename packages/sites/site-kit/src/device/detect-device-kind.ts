import { isHandheldDevice } from './is-handheld-device';
import { isTouchDevice } from './is-touch-device';

/**
 * The kind of device the page is used on, for the controls it tells about. A
 * `'desktop'` has a keyboard and a mouse. A `'handheld'`, a phone or a
 * tablet, has only a touch screen. A `'touch-desktop'`, such as a laptop with
 * a touch screen, has all three, so games show it their touch controls too.
 */
export type DeviceKind = 'desktop' | 'handheld' | 'touch-desktop';

/** Returns the kind of device the page is likely used on. */
export function detectDeviceKind(): DeviceKind {
    if (isHandheldDevice()) return 'handheld';
    return isTouchDevice() ? 'touch-desktop' : 'desktop';
}
