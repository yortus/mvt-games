/** Whether the page is likely used by touch, so games want on-screen controls. */
export function isTouchDevice(): boolean {
    return 'ontouchstart' in globalThis || navigator.maxTouchPoints > 0;
}
