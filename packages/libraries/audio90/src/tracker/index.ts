// `audio90/tracker`: what an editor or a tracker view needs beside the chips.
// It lays a song's cells out as text, and gives the sizes behind the Audio90's
// voices, its sample memory and its scope. A page that only plays songs and
// sounds needs none of it.

export {
    AUDIO90_CELL_TEXT_WIDTH,
    AUDIO90_SAMPLE_MEMORY,
    AUDIO90_SCOPE_LENGTH,
    AUDIO90_SCOPE_PANS,
    AUDIO90_SCOPE_POINTS,
    AUDIO90_VOICE_COUNT,
    formatAudio90Cell,
    type Audio90SongPattern,
} from '../audio90';
