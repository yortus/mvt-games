import { defineConfig } from 'vitepress';

// BASE_URL from CI is the repo root (e.g. /mvt-games/).
// VitePress docs live under /docs/ within that base.
const repoBase = process.env.BASE_URL ?? '/';
const base = repoBase.endsWith('/')
    ? `${repoBase}docs/`
    : `${repoBase}/docs/`;

export default defineConfig({
    title: 'MVT Games',
    description: 'Architecture guides, style conventions, and reactivity patterns for the MVT Games project.',
    base,
    outDir: '../dist/docs',

    appearance: 'dark',

    // Inline __SITE_ROOT__ so the custom Layout can build cross-site links
    // (Games, Playground) that bypass VitePress's SPA router.
    vite: {
        define: {
            __SITE_ROOT__: JSON.stringify(repoBase),
        },
    },

    themeConfig: {
        // Cross-site nav (Games / Docs / Playground) is rendered by the custom
        // Layout via the nav-bar-content-before slot so the links are plain
        // <a> tags not intercepted by VitePress's SPA router.
        nav: [],

        sidebar: [
            {
                text: 'Guides',
                items: [
                    { text: 'Documentation Home', link: '/' },
                    { text: 'MVT Architecture', link: '/mvt-guide' },
                    { text: 'MVT Foundations', link: '/mvt-foundations' },
                    { text: 'Style Guide', link: '/style-guide' },
                ],
            },
            {
                text: 'Reactivity',
                items: [
                    { text: 'Overview', link: '/reactivity-guide/' },
                    { text: 'Push vs Pull', link: '/reactivity-guide/push-vs-pull' },
                    { text: 'Events', link: '/reactivity-guide/events' },
                    { text: 'Signals', link: '/reactivity-guide/signals' },
                    { text: 'Watchers', link: '/reactivity-guide/watchers' },
                    { text: 'Comparison', link: '/reactivity-guide/comparison' },
                    { text: 'Examples', link: '/reactivity-guide/examples' },
                ],
            },
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/yortus/mvt-games' },
        ],

        search: {
            provider: 'local',
        },
    },
});
