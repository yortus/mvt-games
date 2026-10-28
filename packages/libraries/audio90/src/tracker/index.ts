// `audio90/tracker`: what an editor or a tracker view needs beside the chips.
// It attaches a scope to a chip, to show what each voice is playing, lays a
// song's cells out as text, and gives the sizes of the Audio90's voices and
// its sample memory. A page that only plays songs and sounds needs none of it.

export { AUDIO90_CELL_TEXT_WIDTH, AUDIO90_SAMPLE_MEMORY, AUDIO90_VOICE_COUNT, formatAudio90Cell, type Audio90SongPattern } from '../audio90';
export { createScope, type Scope, SCOPE_POINTS } from '../shared';
