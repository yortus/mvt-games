// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The actions a puzzle can take back, newest last, each as the edges it
 * changed were before it. An action is made in three parts: `start`, then
 * `keepEdge` for each edge it is about to change, then `finish`.
 */
export interface UndoHistory {
    /** How many actions can be taken back. */
    readonly count: number;
    /** Starts an action. */
    start: () => void;
    /** Keeps `edge`'s mark as it is, before the action changes it, the first time the action touches it. */
    keepEdge: (edge: number) => void;
    /** Finishes the action, and keeps it, if it changed anything. Returns whether it did. */
    finish: () => boolean;
    /** Takes back the last action, putting its edges' marks back as they were. Returns the edges it put back, or undefined if there was nothing to take back. */
    undo: () => readonly number[] | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UndoHistoryOptions {
    /** The marks on the puzzle's edges, which actions change, and undo puts back. */
    readonly marks: Uint8Array;
    /** The most actions kept. The oldest goes as another comes. */
    readonly mostUndos: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a history with nothing to take back. */
export function createUndoHistory(options: UndoHistoryOptions): UndoHistory {
    const { marks, mostUndos } = options;
    const actions: Action[] = [];
    // The action being made: the edges it changes, and their marks before it
    let edges: number[] = [];
    let edgeMarks: number[] = [];

    return {
        get count() { return actions.length; },
        start() {
            edges = [];
            edgeMarks = [];
        },
        keepEdge(edge) {
            if (edges.includes(edge)) return;
            edges.push(edge);
            edgeMarks.push(marks[edge]);
        },
        finish() {
            // An edge drawn and then taken back within the action leaves nothing to undo
            const changed: number[] = [];
            const before: number[] = [];
            for (let i = 0; i < edges.length; i++) {
                if (marks[edges[i]] === edgeMarks[i]) continue;
                changed.push(edges[i]);
                before.push(edgeMarks[i]);
            }
            edges = [];
            edgeMarks = [];
            if (changed.length === 0) return false;
            actions.push({ edges: changed, marks: before });
            if (actions.length > mostUndos) actions.shift();
            return true;
        },
        undo() {
            const action = actions.pop();
            if (action === undefined) return undefined;
            for (let i = 0; i < action.edges.length; i++) marks[action.edges[i]] = action.marks[i];
            return action.edges;
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Action {
    readonly edges: readonly number[];
    readonly marks: readonly number[];
}
