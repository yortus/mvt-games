// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Scales an element of a fixed size in CSS, as large as the sandbox's window
 * allows without changing its shape, and centres it. It scales again as the
 * window's size changes.
 */
export function fitToWindow(element: HTMLElement, width: number, height: number): void {
    element.style.position = 'absolute';
    element.style.left = '50%';
    element.style.top = '50%';
    element.style.transform = 'translate(-50%, -50%)';
    fit();
    window.addEventListener('resize', fit);

    function fit(): void {
        const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
        element.style.width = `${Math.floor(width * scale)}px`;
        element.style.height = `${Math.floor(height * scale)}px`;
    }
}

/** The colour behind a project that names none. */
export const DEFAULT_BACKGROUND = 0x1a1a2e;
