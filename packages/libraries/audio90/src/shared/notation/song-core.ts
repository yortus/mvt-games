// The parts of a song every chip's song has, as `parseSongCore` makes them
// from a song's options.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What every chip's song has, as `parseSongCore` makes it. */
export interface SongCore<I> {
    readonly bpm: number;
    readonly rowsPerBeat: number;
    readonly swing: number;
    readonly channelCount: number;
    readonly instruments: readonly I[];
    readonly instrumentLetters: readonly string[];
    readonly patterns: readonly SongPattern[];
    readonly order: readonly SongOrderEntry[];
    readonly loop: number;
    readonly durationMs: number;
    readonly volume: number;
}

/** One pattern of a song: rows of cells, one cell per channel. */
export interface SongPattern {
    /** Its name in the song's options' `patterns`. */
    readonly name: string;
    /** How many rows it has, 1 or more. */
    readonly rowCount: number;
    /**
     * The cells, the chip's `CellGrammar.stride` numbers each. They run row
     * by row, and within a row, channel by channel. Each cell starts with the
     * fields every chip's cells have, `CELL_NOTE` to `CELL_PULSE`.
     */
    readonly cells: Float64Array;
}

/** One entry in a song's playing order: a pattern, and how far to transpose it. */
export interface SongOrderEntry {
    /** The pattern's index in the song's patterns. */
    readonly pattern: number;
    /** Semitones added to the pattern's written notes. An instrument's own note is not transposed. */
    readonly transpose: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What every chip's song options have. */
export interface SongCoreOptions<I> extends SongTempo {
    readonly instruments: Readonly<Record<string, I>>;
    readonly patterns: Readonly<Record<string, string>>;
    readonly order: readonly string[];
    readonly loop?: number;
    readonly volume?: number;
}

/** A song's tempo, as its options give it. */
export interface SongTempo {
    readonly bpm: number;
    readonly rowsPerBeat?: number;
    readonly swing?: number;
}
