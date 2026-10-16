import { type HighscoreRow, type HighscoreStore, type HighscoreTables, isValidInitials, findRank } from '../../highscores';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Arcade's highscore tables, one for each game that keeps one, shared by
 * everyone who plays, and the score of a run that places in one: waiting for
 * the visitor's initials, being sent, then shown in its table.
 *
 * Like the Arcade's own model, nothing here moves with time. The tables
 * arrive from the store when they arrive; each answer may only move the
 * state on, and only if nothing has happened since it was asked for.
 */
export interface HighscoresModel {
    // --- The tables ---------------------------------------------------------

    /** Whether the tables have arrived: still on their way, here, or out of reach (none has ever arrived). */
    readonly status: HighscoresStatus;
    /** Counts each change to the tables, so a view knows when to draw them again. */
    readonly tablesRevision: number;
    /** The table of the entry with `entryId`, best first: empty if it has no scores yet, or has not arrived. */
    readonly tableFor: (entryId: string) => readonly HighscoreRow[];
    /** The best score in the entry's table, for a HUD's "HI": 0 if there is none. */
    readonly bestScoreFor: (entryId: string) => number;
    /** Asks for the tables again: they may have changed since, from anyone. */
    readonly reload: () => void;

    // --- A score that places ------------------------------------------------

    /** Where a score that places is, if there is one. */
    readonly placing: PlacingPhase;
    /** The entry the score is for. */
    readonly placingEntryId: string | undefined;
    /** The score. */
    readonly placingScore: number;
    /**
     * Where the score places, 1 for the top: in the table it was checked
     * against while asking and sending, and where it went once shown.
     * `undefined` once shown if it no longer placed, or was not entered.
     */
    readonly placingRank: number | undefined;
    /** Why a score shown is not in its table, if it is not: turned down, or the tables out of reach. */
    readonly placingProblem: PlacingProblem | undefined;
    /**
     * A run of the entry with `entryId` has ended with `score`. If the score
     * would place in the entry's table, it waits for initials. A run that does
     * not place, or ends while a score is placing or the tables have not
     * arrived, changes nothing.
     */
    readonly runEnded: (entryId: string, score: number) => void;
    /** Sends the score waiting for initials, under `initials`. Does nothing unless they are valid initials. */
    readonly submitInitials: (initials: string) => void;
    /**
     * Ends the placing, whatever its phase: a score waiting for initials is
     * dropped, and one being sent is still entered, but not shown.
     */
    readonly close: () => void;

    /** The initials entered last, or remembered from a visit before, to offer next time. */
    readonly lastInitials: string | undefined;

    /** Nothing here moves with time. */
    readonly update: (deltaMs: number) => void;
}

/** Whether the tables have arrived. They may be on their way, here, or out of reach. */
export type HighscoresStatus = 'loading' | 'ready' | 'unavailable';

/** A score that places: none, waiting for initials, being sent, or shown in its table. */
export type PlacingPhase = 'none' | 'asking' | 'sending' | 'shown';

/** Why a score shown is not in its table: the tables turned it down, or could not be reached. */
export type PlacingProblem = 'refused' | 'unreachable';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make the highscores model. */
export interface HighscoresModelOptions {
    /** Where the tables are kept. They are asked for as the model is made. */
    readonly store: HighscoreStore;
    /** The initials the visitor entered on a visit before, if the page remembered them. Ignored if not valid. */
    readonly rememberedInitials?: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the model of the Arcade's highscore tables. It asks for the tables at once. */
export function createHighscoresModel(options: HighscoresModelOptions): HighscoresModel {
    const { store } = options;

    let status: HighscoresStatus = 'loading';
    let tables: HighscoreTables = new Map();
    let tablesRevision = 0;
    /** Counts requests for the tables, so only the latest is taken. */
    let loadCount = 0;
    /** Counts submissions' tables taken, so tables asked for before one are not taken after it. */
    let submittedCount = 0;

    let placing: PlacingPhase = 'none';
    let placingEntryId: string | undefined;
    let placingScore = 0;
    let placingRank: number | undefined;
    let placingProblem: PlacingProblem | undefined;
    /** Counts placings, so an answer about one that has been closed changes only the tables. */
    let placingCount = 0;

    let lastInitials = options.rememberedInitials !== undefined && isValidInitials(options.rememberedInitials)
        ? options.rememberedInitials
        : undefined;

    const model: HighscoresModel = {
        get status() {
            return status;
        },
        get tablesRevision() {
            return tablesRevision;
        },
        tableFor: (entryId) => tables.get(entryId) ?? NO_ROWS,
        bestScoreFor: (entryId) => tables.get(entryId)?.[0]?.score ?? 0,
        reload() {
            const load = ++loadCount;
            const submittedBefore = submittedCount;
            store.loadAll().then(
                (loaded) => {
                    if (load !== loadCount || submittedBefore !== submittedCount) return;
                    tables = loaded;
                    status = 'ready';
                    tablesRevision++;
                },
                () => {
                    // Tables that have arrived before are kept: they are only older
                    if (load === loadCount && status === 'loading') status = 'unavailable';
                },
            );
        },

        get placing() {
            return placing;
        },
        get placingEntryId() {
            return placingEntryId;
        },
        get placingScore() {
            return placingScore;
        },
        get placingRank() {
            return placingRank;
        },
        get placingProblem() {
            return placingProblem;
        },
        runEnded(entryId, score) {
            if (placing !== 'none' || status !== 'ready' || !Number.isSafeInteger(score) || score < 1) return;
            const rank = findRank(model.tableFor(entryId), score);
            if (rank === undefined) return;
            placingCount++;
            placing = 'asking';
            placingEntryId = entryId;
            placingScore = score;
            placingRank = rank;
            placingProblem = undefined;
        },
        submitInitials(initials) {
            if (placing !== 'asking' || placingEntryId === undefined || !isValidInitials(initials)) return;
            lastInitials = initials;
            placing = 'sending';
            const attempt = placingCount;
            const entryId = placingEntryId;
            store.submit({ gameId: entryId, initials, score: placingScore }).then(
                (result) => {
                    if (result.kind === 'entered') {
                        const next = new Map(tables);
                        next.set(entryId, result.table);
                        tables = next;
                        submittedCount++;
                        tablesRevision++;
                    }
                    if (attempt !== placingCount || placing !== 'sending') return;
                    // Initials checked here are checked the same way there; if they still differ, ask again
                    if (result.kind === 'refused' && result.reason === 'bad-initials') placing = 'asking';
                    else show(result.kind === 'entered' ? result.rank : undefined, result.kind === 'refused' ? 'refused' : undefined);
                },
                () => {
                    if (attempt === placingCount && placing === 'sending') show(undefined, 'unreachable');
                },
            );
        },
        close() {
            if (placing === 'none') return;
            placingCount++;
            placing = 'none';
            placingEntryId = undefined;
            placingRank = undefined;
            placingProblem = undefined;
        },

        get lastInitials() {
            return lastInitials;
        },

        update(_deltaMs) {
            // Nothing to advance
        },
    };

    model.reload();
    return model;

    function show(rank: number | undefined, problem: PlacingProblem | undefined): void {
        placing = 'shown';
        placingRank = rank;
        placingProblem = problem;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NO_ROWS: readonly HighscoreRow[] = [];
