/** Returns whether the page is likely used by touch, so that games show on-screen controls. */
export function isTouchDevice(): boolean {
    return 'ontouchstart' in globalThis || navigator.maxTouchPoints > 0;
}
