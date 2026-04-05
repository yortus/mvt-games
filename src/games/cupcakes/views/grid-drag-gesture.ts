// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A general-purpose grid drag gesture tracker. No game-specific concepts. */
export interface GridDragGesture {
    /** Whether a drag gesture is currently active. */
    readonly isActive: boolean;
    /** Grid cell where the drag started. */
    readonly origin: Readonly<{ col: number; row: number }>;
    /** Grid cell currently under the pointer (or -1/-1 if none qualifies). */
    readonly target: Readonly<{ col: number; row: number }>;
    /** Current pointer position in local pixel coordinates. */
    readonly pointer: Readonly<{ x: number; y: number }>;

    /** Begin a drag gesture at the given pointer position. No-op if the callback returns null. */
    begin(x: number, y: number): void;
    /** Update the pointer position during an active drag. Target is resolved via the callback. */
    move(x: number, y: number): void;
    /** End the drag gesture. */
    end(): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GridDragGestureOptions {
    /** Convert a pixel position to the corresponding grid cell, or undefined if none qualifies. */
    toGridPosition(x: number, y: number): { col: number; row: number } | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGridDragGesture(options: GridDragGestureOptions): GridDragGesture {
    const { toGridPosition } = options;

    let isActive = false;
    const origin = { col: -1, row: -1 };
    const target = { col: -1, row: -1 };
    const pointer = { x: 0, y: 0 };

    return {
        get isActive() { return isActive; },
        get origin() { return origin; },
        get target() { return target; },
        get pointer() { return pointer; },

        begin(x: number, y: number): void {
            const pos = toGridPosition(x, y);
            if (pos === undefined) return;
            isActive = true;
            origin.row = pos.row;
            origin.col = pos.col;
            target.row = -1;
            target.col = -1;
            pointer.x = x;
            pointer.y = y;
        },

        move(x: number, y: number): void {
            pointer.x = x;
            pointer.y = y;
            const pos = toGridPosition(x, y);
            target.row = pos ? pos.row : -1;
            target.col = pos ? pos.col : -1;
        },

        end(): void {
            isActive = false;
            target.row = -1;
            target.col = -1;
        },
    };
}
