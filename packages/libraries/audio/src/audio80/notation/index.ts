export { createAudio80Instrument, type Audio80Envelope, type Audio80FilterSweep, type Audio80Instrument, type Audio80InstrumentOptions, type Audio80PulseSweep, type Audio80Vibrato } from './instrument';
export { createAudio80SoundEffect, isAudio80SoundEffect, type Audio80SoundEffect, type Audio80SoundEffectOptions } from './sound-effect';
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
    createAudio80Song,
    isAudio80Song,
    NO_NOTE,
    RELEASE,
} from './song';
export type { Audio80EchoSettings, Audio80FilterSettings, Audio80Song, Audio80SongOptions, SongOrderEntry, SongPattern } from './song';
