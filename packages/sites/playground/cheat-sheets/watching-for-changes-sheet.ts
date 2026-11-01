import type { CheatSheet } from './cheat-sheet';

/** Reactions, computed values and watchers. */
export const WATCHING_FOR_CHANGES_SHEET: CheatSheet = {
    id: 'watching-for-changes',
    title: 'Watching for changes',
    summary: 'How a view does something only when a value changes, rather than every tick: play a sound, rebuild some text, or redraw a shape.',
    groups: [
        {
            title: 'Reactions and computed values',
            entries: [
                {
                    name: 'createReaction',
                    from: '@mvtjs/utils',
                    signature: [
                        'createReaction(options: {',
                        '    watch: () => T;',
                        '    when?: T | ((current: T, previous: T) => boolean);',
                        '    react: (current: T, previous: T) => void;',
                        '}): () => void',
                    ].join('\n'),
                    useFor: 'Do something once, at the moment a value changes, such as playing a sound as the score goes up. Call the reaction every tick.',
                    snippet: [
                        'const playChimeWhenScoreRises = createReaction({',
                        '    watch: () => model.score,',
                        '    when: increased,',
                        '    react: () => sound.play(CHIME),',
                        '});',
                        'setRefresh(view, playChimeWhenScoreRises);',
                    ].join('\n'),
                    chapter: 'chapters/09-noticing-changes',
                },
                {
                    name: 'createComputed',
                    from: '@mvtjs/utils',
                    signature: [
                        'createComputed(options: {',
                        '    watch: () => T;',
                        '    compute: (current: T) => R;',
                        '}): Computed<R>',
                    ].join('\n'),
                    useFor: "Make a value, such as a label's text, only when what it's made from changes. Read it by calling it.",
                    snippet: [
                        'const scoreText = createComputed({',
                        '    watch: () => model.score,',
                        '    compute: (score) => `Score: ${score}`,',
                        '});',
                        'setRefresh(view, () => {',
                        '    label.text = scoreText();',
                        '});',
                    ].join('\n'),
                    chapter: 'chapters/09-noticing-changes',
                },
                {
                    name: 'watch',
                    from: '@mvtjs/utils',
                    signature: 'watch(getters: (() => T) | Record<string, () => unknown>): Watcher',
                    useFor: 'Read several values at once, and see which have changed since you last polled. Poll it every tick.',
                    snippet: [
                        'const watcher = watch({',
                        '    lives: () => model.lives,',
                        '    level: () => model.level,',
                        '});',
                        'setRefresh(view, () => {',
                        '    const { lives, level } = watcher.poll();',
                        '    if (lives.changed) drawLives(lives.current);',
                        '    if (level.changed) drawLevel(level.current);',
                        '});',
                    ].join('\n'),
                    chapter: 'chapters/09-noticing-changes',
                },
            ],
        },
        {
            title: 'Conditions for when',
            entries: [
                {
                    name: 'increased',
                    from: '@mvtjs/utils',
                    useFor: "Pass it as a reaction's `when`, to react only as a number goes up, such as a count of shots fired.",
                    chapter: 'chapters/09-noticing-changes',
                },
                {
                    name: 'decreased',
                    from: '@mvtjs/utils',
                    useFor: "Pass it as a reaction's `when`, to react only as a number goes down, such as the lives left.",
                    chapter: 'chapters/09-noticing-changes',
                },
                {
                    name: 'changedFrom',
                    from: '@mvtjs/utils',
                    useFor: "Pass it as a reaction's `when`, to react only as a value leaves the one you name, such as a phase leaving `'playing'`.",
                    snippet: [
                        'const playJingleWhenGameEnds = createReaction({',
                        '    watch: () => model.phase,',
                        "    when: changedFrom('playing'),",
                        '    react: () => sound.play(GAME_OVER),',
                        '});',
                    ].join('\n'),
                    chapter: 'chapters/09-noticing-changes',
                },
            ],
        },
    ],
};
