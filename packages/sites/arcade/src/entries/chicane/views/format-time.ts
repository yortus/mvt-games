// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** A time as minutes, seconds and hundredths, such as 1:02.35. */
export function formatTime(ms: number): string {
    const hundredths = Math.floor(ms / 10);
    const minutes = Math.floor(hundredths / 6000);
    const seconds = Math.floor(hundredths / 100) % 60;
    const fraction = hundredths % 100;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}.${fraction < 10 ? '0' : ''}${fraction}`;
}
