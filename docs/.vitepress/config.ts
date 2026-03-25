import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

// BASE_URL from CI is the repo root (e.g. /mvt-games/).
// VitePress docs live under /docs/ within that base.
const repoBase = process.env.BASE_URL ?? '/';
const base = repoBase.endsWith('/')
    ? `${repoBase}docs/`
    : `${repoBase}/docs/`;

export default withMermaid(defineConfig({
    title: 'MVT Games',
    description: 'Architecture guides, style conventions, and reactivity patterns for the MVT Games project.',
    base,
    outDir: '../dist/docs',
    srcExclude: ['RESTRUCTURE-PLAN.md'],

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
                text: 'Home',
                items: [
                    { text: 'Documentation Home', link: '/' },
                ],
            },
            {
                text: 'Learn MVT',
                items: [
                    { text: 'What is MVT?', link: '/learn/what-is-mvt' },
                    { text: 'Architecture Overview', link: '/learn/architecture-overview' },
                    { text: 'Models', link: '/learn/models' },
                    { text: 'Views', link: '/learn/views' },
                    { text: 'The Ticker', link: '/learn/ticker' },
                    { text: 'Bindings', link: '/learn/bindings' },
                    { text: 'Walkthrough', link: '/learn/walkthrough' },
                    { text: 'Next Steps', link: '/learn/next-steps' },
                ],
            },
            {
                text: 'Guide',
                items: [
                    { text: 'Time Management', link: '/guide/time-management' },
                    { text: 'Bindings in Depth', link: '/guide/bindings-in-depth' },
                    { text: 'Change Detection', link: '/guide/change-detection' },
                    { text: 'Model Composition', link: '/guide/model-composition' },
                    { text: 'View Composition', link: '/guide/view-composition' },
                    { text: 'Presentation State', link: '/guide/presentation-state' },
                    { text: 'Hot Paths', link: '/guide/hot-paths' },
                    { text: 'Testing', link: '/guide/testing' },
                    { text: 'Adding a Game', link: '/guide/adding-a-game' },
                    { text: 'Common Mistakes', link: '/guide/common-mistakes' },
                ],
            },
            {
                text: 'Reference',
                items: [
                    { text: 'Architecture Rules', link: '/reference/architecture-rules' },
                    { text: 'Style Guide', link: '/reference/style-guide' },
                    { text: 'Glossary', link: '/reference/glossary' },
                    { text: 'Project Structure', link: '/reference/project-structure' },
                ],
            },
            {
                text: 'Foundations',
                items: [
                    { text: 'Proven Patterns', link: '/foundations/proven-patterns' },
                ],
            },
            {
                text: 'Reactivity',
                items: [
                    { text: 'Overview', link: '/reactivity/' },
                    { text: 'Push vs Pull', link: '/reactivity/push-vs-pull' },
                    { text: 'Events', link: '/reactivity/events' },
                    { text: 'Signals', link: '/reactivity/signals' },
                    { text: 'Watchers', link: '/reactivity/watchers' },
                    { text: 'Comparison', link: '/reactivity/comparison' },
                    { text: 'Examples', link: '/reactivity/examples' },
                ],
            },
            {
                text: 'AI Agents',
                collapsed: true,
                items: [
                    { text: 'Agent Orientation', link: '/ai-agents/' },
                    { text: 'Skill: MVT Model', link: '/ai-agents/skill-mvt-model' },
                    { text: 'Skill: MVT View', link: '/ai-agents/skill-mvt-view' },
                    { text: 'Skill: Code Style', link: '/ai-agents/skill-code-style' },
                    { text: 'Skill: Documentation', link: '/ai-agents/skill-documentation' },
                ],
            },
            {
                text: 'Contributing',
                items: [
                    { text: 'Documentation Guide', link: '/contributing' },
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
}));
