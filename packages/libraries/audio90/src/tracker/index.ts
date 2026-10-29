// What an editor or a tracker view needs beside the chips: a scope attached
// to a chip, to show what each voice is playing, and a song's cells laid out
// as text. A page that only plays songs and sounds needs none of it, and,
// since each is a module of its own, loads none of it.

export { AUDIO90_CELL_TEXT_WIDTH, formatAudio90Cell } from './format-cell';
export { createScope, type Scope } from './scope';
