/** Eases `t`, from 0 to 1, in and out: slow at both ends and quickest in the middle. Outside 0 to 1, it holds at the nearer end. */
export function easeInOut(t: number): number {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
}
