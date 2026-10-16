export { createInstrument, type Envelope, type FilterSweep, type Instrument, type InstrumentOptions, type PulseSweep, type Vibrato } from './instrument';
export { createSoundEffect, isSoundEffect, type SoundEffect, type SoundEffectOptions } from './sound-effect';
export {
    CELL_ARPEGGIO,
    CELL_FILTER,
    CELL_GLIDE,
    CELL_INSTRUMENT,
    CELL_IS_OWN_NOTE,
    CELL_NOTE,
    CELL_PULSE,
    CELL_SLIDE,
    CELL_STRIDE,
    CELL_VIBRATO,
    CELL_VOLUME,
    createSong,
    isSong,
    NO_NOTE,
    RELEASE,
    computeSongDurationMs,
} from './song';
export type { EchoSettings, FilterSettings, Song, SongOptions, SongOrderEntry, SongPattern } from './song';
