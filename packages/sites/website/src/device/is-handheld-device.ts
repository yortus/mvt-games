/**
 * Returns whether the page is likely used on a phone or a tablet: a device
 * whose main pointer is a finger, with no hover. A laptop with a touch screen
 * has a mouse or a trackpad as its main pointer, so it is not one.
 */
export function isHandheldDevice(): boolean {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}
