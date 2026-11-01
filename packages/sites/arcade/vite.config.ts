import { defineSiteConfig } from '@mvtjs/site-kit/vite';

// The arcade is the site's root: its build writes the root's pages too, which
// send visitors on to it. The demos and Sudoku were arcade entries once, so
// their old addresses send visitors on to their new ones.
export default defineSiteConfig({
    site: 'arcade',
    root: import.meta.dirname,
    isSiteRoot: true,
    movedEntries: {
        'boids': 'demos',
        'boids-3d': 'demos',
        'coral': 'demos',
        'double-pendulum': 'demos',
        'falling-sand': 'demos',
        'fireworks': 'demos',
        'fractal-forest': 'demos',
        'fractalscope': 'demos',
        'fruit-machine': 'demos',
        'reordering-lists': 'demos',
        'sudoku-digger': 'demos',
        'tune-tracker': 'demos',
        'sudoku': 'puzzles',
    },
});
