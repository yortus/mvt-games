// When each effect of a match's celebration runs, as a list of named steps
// on one clock. The steps say nothing about how each effect looks. That's
// up to the views that read them.
export const MATCH_STEPS = [
    { name: 'flash', startMs: 0, durationMs: 100 },
    { name: 'shake', startMs: 50, durationMs: 400 },
    { name: 'dust', startMs: 150, durationMs: 500 },
    { name: 'popup', startMs: 200, durationMs: 600 },
    { name: 'stars', startMs: 250, durationMs: 800 },
] as const;
