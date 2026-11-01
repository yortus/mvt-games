// The browser's sound chips, which the page's sound imports the first time
// the visitor clicks or presses a key, so a visitor who never plays downloads
// none of their code. `audio90` holds them beside the songs and sound effects
// the home page loads at once, so this module is the line the bundler splits
// at. Not exported: only `page-sound.ts` imports it, and the runner's tests
// mock it with `fake-web-audio.ts`.

export { createAudio80, createAudio90 } from 'audio90';
