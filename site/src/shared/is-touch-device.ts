export function isTouchDevice(): boolean {
    return 'ontouchstart' in globalThis || navigator.maxTouchPoints > 0;
}
