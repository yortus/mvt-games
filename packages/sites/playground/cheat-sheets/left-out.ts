/**
 * The value exports of this repo's libraries that no cheat sheet shows, each
 * with the reason. A test fails for an export that's neither on a sheet nor
 * here, so a new export needs a decision.
 */
export const LEFT_OUT: Readonly<Record<string, string>> = {
    registerRenderer: 'Adds a renderer of its own to the view tick API. A project uses the renderers the playground provides.',
    createDestroyRegistry: 'Builds the destroy hooks for a renderer of its own.',
    addReads: "Measures a tick's work, as the benchmarks do.",
    countTick: "Measures a tick's work, as the benchmarks do.",
    tickCounter: "Measures a tick's work, as the benchmarks do.",
    createPerformanceHistory: "The playground's Performance tab measures a project's performance itself.",
    createPerformanceMeter: "The playground's Performance tab measures a project's performance itself.",
    METRIC_KINDS: "The playground's Performance tab measures a project's performance itself.",
    estimateFrameBudgetMs: "The playground's Performance tab measures a project's performance itself.",
    createGpuTimer: "The playground's Performance tab measures a project's performance itself.",
    PerfmonView: "The playground's Performance tab shows the same panel.",
    createTextureRegistry: 'Loads a spritesheet from a URL, and a project in the playground has only its code.',
    Fragment: 'What JSX compiles to. You never call it yourself.',
    jsx: 'What JSX compiles to. You never call it yourself.',
    destroyElement: "Destroys an HTML view the MVT way. The JSX sheet's `onDestroyed` covers what a project needs.",
    destroyObject: "Destroys a three.js view the MVT way. The JSX sheet's `onDestroyed` covers what a project needs.",
    isDestroyed: "The JSX sheet's `onDestroyed` covers what a project needs.",
    onDestroyed: 'The JSX attribute of the same name, on the JSX sheets, does the same.',
    createAudio80: 'The playground makes the project\'s chip, and passes it to `start` as `sound`.',
    createAudio90: 'The playground passes every project an Audio80. The Audio90 has guides of its own.',
    createAudio90Sound: 'The playground passes every project an Audio80. The Audio90 has guides of its own.',
    createAudio90Song: 'The playground passes every project an Audio80. The Audio90 has guides of its own.',
    createAudio90Sample: 'The playground passes every project an Audio80. The Audio90 has guides of its own.',
    prepareAudio90Samples: 'The playground passes every project an Audio80. The Audio90 has guides of its own.',
    parseAudio90Song: 'Reads a song saved as text, for tools such as a tracker.',
    printAudio90Song: 'Writes a song out as text, for tools such as a tracker.',
    printAudio90Cell: 'Writes one cell of a song, for tools such as a tracker.',
    AUDIO90_CELL_TEXT_WIDTH: 'For tools such as a tracker.',
    AUDIO90_SAMPLE_MEMORY: 'The playground passes every project an Audio80. The Audio90 has guides of its own.',
    AUDIO90_VOICE_COUNT: 'The playground passes every project an Audio80. The Audio90 has guides of its own.',
    createScope: "Draws a chip's waves, for tools such as a tracker.",
    SCOPE_POINTS: "Draws a chip's waves, for tools such as a tracker.",
};
