import type { CheatSheet } from './cheat-sheet';

/** The Audio80 sound chip that `start` is passed, and how to make its sounds and songs. */
export const SOUND_SHEET: CheatSheet = {
    id: 'sound',
    title: 'Sound',
    summary: 'Sound effects and music, on the Audio80 sound chip that your `start` is passed as `sound`. A view plays a sound as a value changes, usually from a reaction.',
    groups: [
        {
            title: 'Playing on the chip',
            entries: [
                {
                    name: 'Audio80.play',
                    from: 'audio90',
                    useFor: 'Play a sound effect, or start a song in place of the one playing. It returns an id, which `stop` takes.',
                    snippet: [
                        'const playZapOnEachShot = createReaction({',
                        '    watch: () => model.shotsFired,',
                        '    when: increased,',
                        '    react: () => sound.play(ZAP),',
                        '});',
                    ].join('\n'),
                    chapter: 'chapters/20-sound-and-music',
                },
                {
                    name: 'Audio80.queue',
                    from: 'audio90',
                    useFor: 'Play a song next, without a gap, as the song playing reaches its end, such as the stage tune after a fanfare.',
                    chapter: 'chapters/20-sound-and-music',
                },
                {
                    name: 'Audio80.stop',
                    from: 'audio90',
                    useFor: 'Stop a play by its id, or everything with no id, at once or with a fade.',
                },
                {
                    name: 'Audio80.tempoScale',
                    from: 'audio90',
                    useFor: 'Play the music faster or slower than its own tempo, such as faster when time is running short. 1 is its own tempo.',
                },
            ],
        },
        {
            title: 'Making sounds and songs',
            entries: [
                {
                    name: 'createAudio80Sound',
                    from: 'audio90',
                    useFor: 'Make a sound once, as a module loads, then play it as often as you like. Its options set its wave, envelope, pitch and steps.',
                    snippet: [
                        'export const ZAP = createAudio80Sound({',
                        "    note: 'C-6',",
                        "    glideTo: 'C-4',",
                        '    pulseWidth: 0.25,',
                        '    envelope: { attackMs: 0, decayMs: 120, sustain: 0, releaseMs: 0 },',
                        '});',
                    ].join('\n'),
                    chapter: 'chapters/20-sound-and-music',
                },
                {
                    name: 'createAudio80Song',
                    from: 'audio90',
                    useFor: 'Make a song from patterns written as text, played by instruments that you make with `createAudio80Sound`.',
                    snippet: [
                        'export const TUNE = createAudio80Song({',
                        '    bpm: 120,',
                        '    instruments: { L: LEAD },',
                        '    patterns: {',
                        '        a: `',
                        '            | C-5 L',
                        '            | E-5',
                        '            | G-5',
                        '            | C-6',
                        '        `,',
                        '    },',
                        "    order: ['a'],",
                        '});',
                    ].join('\n'),
                    chapter: 'chapters/20-sound-and-music',
                },
            ],
        },
    ],
    moreAt: [
        { label: 'Using the Audio80', url: 'https://github.com/yortus/mvt-games/blob/main/packages/libraries/audio90/docs/using-the-audio80.md' },
        { label: 'Writing tracker music', url: 'https://github.com/yortus/mvt-games/blob/main/packages/libraries/audio90/docs/writing-tracker-music.md' },
    ],
};
