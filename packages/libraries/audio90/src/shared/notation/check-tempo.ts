import type { SongTempo } from './song-core';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Checks a song's tempo, and returns its rows per beat and swing with their defaults. Throws if any is not valid. */
export function checkTempo(tempo: SongTempo): { readonly rowsPerBeat: number; readonly swing: number } {
    const { bpm } = tempo;
    if (!(Number.isFinite(bpm) && bpm > 0)) throw new Error(`song: bpm must be above 0; got ${bpm}`);
    const rowsPerBeat = tempo.rowsPerBeat ?? 4;
    if (!(Number.isInteger(rowsPerBeat) && rowsPerBeat > 0)) throw new Error(`song: rowsPerBeat must be a whole number, 1 or more; got ${rowsPerBeat}`);
    const swing = tempo.swing ?? 0;
    if (!(swing >= 0 && swing <= 0.5)) throw new Error(`song: swing must be from 0 to 0.5; got ${swing}`);
    return { rowsPerBeat, swing };
}
