import type { Audio80, Audio90 } from 'audio90';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a view plays music on: the songs of a chip of kind `K`, and on the
 * Audio90, the scopes of what its voices play. The code that owns the chip
 * keeps the rest of it, such as `pause` and `volume`, so a view can't pause
 * the sound or change the listener's volume.
 */
export type MusicChip<K extends ChipKind> = MusicChipsByKind[K];

/** What a view plays sound effects on: a chip of kind `K`'s `play` and `stop`, as for `MusicChip`. */
export type SfxChip<K extends ChipKind> = Pick<ChipsByKind[K], 'play' | 'stop'>;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The chip of each kind. */
interface ChipsByKind {
    readonly audio80: Audio80;
    readonly audio90: Audio90;
}

/** The kinds of chip, by name. */
type ChipKind = keyof ChipsByKind;

/** The members of a chip that play and report its songs. */
type MusicMember = 'play' | 'queue' | 'stop' | 'song' | 'orderIndex' | 'row' | 'beat' | 'tempoScale';

/** The music chip of each kind, as `MusicChip` gives it. */
interface MusicChipsByKind {
    readonly audio80: Pick<Audio80, MusicMember>;
    readonly audio90: Pick<Audio90, MusicMember | 'scope' | 'setScopes'>;
}
