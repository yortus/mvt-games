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
    ignoreDeadLinks: [
        /^\/playground\//,
    ],

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
                text: 'Architecture',
                items: [
                    { text: 'Overview', link: '/architecture/' },
                    { text: 'Models', link: '/architecture/models' },
                    { text: 'Views', link: '/architecture/views' },
                    { text: 'Bindings', link: '/architecture/bindings' },
                    { text: 'The Ticker', link: '/architecture/ticker' },
                    { text: 'Rules', link: '/architecture/rules' },
                    { text: 'Heritage', link: '/architecture/heritage' },
                ],
            },
            {
                text: 'Building with MVT',
                items: [
                    { text: 'Quickstart', link: '/learn/quickstart' },
                    { text: 'The Game Loop', link: '/learn/game-loop' },
                    {
                        text: 'Simulating the World',
                        items: [
                            { text: 'Models', link: '/learn/models' },
                            { text: 'Time Management', link: '/topics/time-management' },
                            { text: 'Model Composition', link: '/topics/model-composition' },
                        ],
                    },
                    {
                        text: 'Presenting the World',
                        items: [
                            { text: 'Views', link: '/learn/views' },
                            { text: 'Bindings', link: '/learn/bindings' },
                            { text: 'View Composition', link: '/topics/view-composition' },
                            { text: 'Bindings in Depth', link: '/topics/bindings-in-depth' },
                        ],
                    },
                    {
                        text: 'Reacting to Changes',
                        items: [
                            { text: 'Why Polling', link: '/topics/reactivity' },
                            { text: 'Change Detection', link: '/topics/change-detection' },
                            { text: 'Events and Signals', link: '/topics/events-and-signals' },
                        ],
                    },
                    {
                        text: 'Adding Visual Polish',
                        items: [
                            { text: 'Presentation State', link: '/topics/presentation-state' },
                            { text: 'Taming Complex Views', link: '/topics/managing-view-complexity' },
                        ],
                    },
                    {
                        text: 'Animating Transitions',
                        items: [
                            { text: 'Phase-Based Transitions', link: '/topics/phase-transitions' },
                            { text: 'Open-Ended Phases', link: '/topics/open-ended-phases' },
                            { text: 'Complex Sequences', link: '/topics/complex-sequences' },
                        ],
                    },
                    {
                        text: 'Iterating with Confidence',
                        items: [
                            { text: 'Testing', link: '/topics/testing' },
                            { text: 'Testing Models', link: '/topics/testing-models' },
                            { text: 'Testing Views', link: '/topics/testing-views' },
                        ],
                    },
                    {
                        text: 'Avoiding Pitfalls',
                        items: [
                            { text: 'Common Mistakes', link: '/topics/common-mistakes' },
                            { text: 'Hot Paths', link: '/topics/hot-paths' },
                        ],
                    },
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
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/yortus/mvt-games' },
        ],

        search: {
            provider: 'local',
        },
    },
}));
