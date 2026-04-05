import gsap from 'gsap';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Swap-specific presentation state for the cupcakes drag interaction.
 * Owns committed-swap bookkeeping and slide animations. The general drag
 * gesture (origin, target, pointer) lives in GridDragGesture.
 */
export interface DragViewModel {
    // ---- Swap state ------------------------------------------------------

    /** True after a swap was accepted - holds cells at swapped positions until cleared. */
    readonly isCommittedSwap: boolean;
    /** Grid position of the swap origin (captured at commit time). */
    readonly swapOrigin: Readonly<{ col: number; row: number }>;
    /** Grid position of the swap target (captured at commit time). */
    readonly swapTarget: Readonly<{ col: number; row: number }>;

    // ---- Animation state -------------------------------------------------

    /** Current visual position for the candidate cell being slid toward the origin. */
    readonly candidateVisual: Readonly<{ x: number; y: number }>;
    /** Current visual position for a returning cell sliding back to its grid position. */
    readonly returningVisual: Readonly<{ x: number; y: number }>;
    /** Grid index of the cell currently being animated as a swap candidate. -1 if none. */
    readonly candidateIdx: number;
    /** Grid index of a cell returning to its original position after deselection. -1 if none. */
    readonly returningIdx: number;

    // ---- Swap intent methods ---------------------------------------------

    /** Mark the current drag as a committed swap (accepted by the model). Captures positions. */
    commitSwap(origin: { col: number; row: number }, target: { col: number; row: number }): void;
    /** Clear the committed swap state (called when the model exits 'swapping'). */
    clearCommittedSwap(): void;

    // ---- Animation methods (called by board-view presentation logic) -----

    /** Schedule an animation sliding the candidate toward a target position. */
    slideCandidate(fromX: number, fromY: number, toX: number, toY: number): void;
    /** Schedule an animation sliding a returning cell back to its grid position. */
    slideReturn(fromX: number, fromY: number, toX: number, toY: number): void;
    /** Set the candidate animation index directly. */
    setCandidateIdx(idx: number): void;
    /** Set the returning animation index directly. */
    setReturningIdx(idx: number): void;

    /** Advance presentation animations by deltaMs. */
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANDIDATE_SLIDE_DURATION = 0.12;
const RETURN_SLIDE_DURATION = 0.15;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDragViewModel(): DragViewModel {
    // Swap state
    let isCommittedSwap = false;
    const swapOrigin = { col: -1, row: -1 };
    const swapTarget = { col: -1, row: -1 };

    // Animation state
    const candidateVisual = { x: 0, y: 0 };
    const returningVisual = { x: 0, y: 0 };
    let candidateIdx = -1;
    let returningIdx = -1;

    const timeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

    const viewModel: DragViewModel = {
        // ---- Swap state accessor ---------------
        get isCommittedSwap() { return isCommittedSwap; },
        get swapOrigin() { return swapOrigin; },
        get swapTarget() { return swapTarget; },

        // ---- Animation state accessors ---------
        get candidateVisual() { return candidateVisual; },
        get returningVisual() { return returningVisual; },
        get candidateIdx() { return candidateIdx; },
        get returningIdx() { return returningIdx; },

        // ---- Swap intent methods ---------------
        commitSwap(origin: { col: number; row: number }, target: { col: number; row: number }): void {
            isCommittedSwap = true;
            swapOrigin.row = origin.row;
            swapOrigin.col = origin.col;
            swapTarget.row = target.row;
            swapTarget.col = target.col;
        },

        clearCommittedSwap(): void {
            isCommittedSwap = false;
            swapOrigin.row = -1;
            swapOrigin.col = -1;
            swapTarget.row = -1;
            swapTarget.col = -1;
            candidateIdx = -1;
            returningIdx = -1;
        },

        // ---- Animation methods -----------------
        setCandidateIdx(idx: number): void {
            candidateIdx = idx;
        },

        setReturningIdx(idx: number): void {
            returningIdx = idx;
        },

        slideCandidate(fromX: number, fromY: number, toX: number, toY: number): void {
            candidateVisual.x = fromX;
            candidateVisual.y = fromY;
            const t = timeline.time();
            timeline.to(candidateVisual, {
                x: toX,
                y: toY,
                duration: CANDIDATE_SLIDE_DURATION,
                ease: 'power2.out',
            }, t);
        },

        slideReturn(fromX: number, fromY: number, toX: number, toY: number): void {
            returningVisual.x = fromX;
            returningVisual.y = fromY;
            const t = timeline.time();
            timeline.to(returningVisual, {
                x: toX,
                y: toY,
                duration: RETURN_SLIDE_DURATION,
                ease: 'power2.out',
                onComplete: () => { returningIdx = -1; },
            }, t);
        },

        update(deltaMs: number): void {
            if (deltaMs > 0) {
                timeline.time(timeline.time() + deltaMs * 0.001);
            }
        },
    };

    return viewModel;
}
