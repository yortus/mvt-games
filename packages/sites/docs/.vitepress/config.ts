import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

// BASE_URL from CI is the repo root (e.g. /mvt-games/).
// VitePress docs live under /docs/ within that base.
const repoBase = process.env.BASE_URL ?? '/';
const base = repoBase.endsWith('/')
    ? `${repoBase}docs/`
    : `${repoBase}/docs/`;
// The site's root, where the Arcade and the playground are too.
const siteBase = base.slice(0, -'docs/'.length);

// The site's origin, such as `https://example.com`, for the full addresses a
// link preview needs. A build with none, for trying the site out, writes them
// from the site's root.
const siteOrigin = process.env.SITE_ORIGIN ?? '';

// The picture a link to any page shows: the Arcade's card wall, which the
// Arcade's build writes at this address
// (packages/sites/arcade/scripts/share-image.ts).
const shareImage = {
    url: `${siteOrigin}${siteBase}arcade/share.jpg`,
    width: 1200,
    height: 630,
    alt: 'The MVT Arcade\'s wall of cards, one for each game and demo',
};

export default withMermaid(defineConfig({
    title: 'MVT Games',
    description: 'Architecture guides, style conventions, and reactivity patterns for the MVT Games project.',
    base,
    outDir: '../../../dist/docs',
    // articles/ holds drafts that are not published yet.
    srcExclude: ['RESTRUCTURE-PLAN.md', 'articles/**'],
    ignoreDeadLinks: [
        /^\/playground\//,
    ],

    appearance: 'dark',

    // What a link to a page shows when it is shared: the page's own title,
    // summary and address, with the site's picture. Sites that build link
    // previews read these tags, and no page sets them itself.
    transformHead({ pageData, siteData }) {
        // The address VitePress serves the page at: `architecture/models.html`, or `architecture/` for an index
        const path = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '.html');
        return [
            ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
            ['meta', { property: 'og:type', content: 'website' }],
            ['meta', { property: 'og:site_name', content: siteData.title }],
            ['meta', { property: 'og:title', content: pageData.title || siteData.title }],
            ['meta', { property: 'og:description', content: pageData.description || siteData.description }],
            ['meta', { property: 'og:url', content: siteOrigin + base + path }],
            ['meta', { property: 'og:image', content: shareImage.url }],
            ['meta', { property: 'og:image:width', content: String(shareImage.width) }],
            ['meta', { property: 'og:image:height', content: String(shareImage.height) }],
            ['meta', { property: 'og:image:alt', content: shareImage.alt }],
        ];
    },

    // Inline __SITE_ROOT__ so the custom Layout can build cross-site links
    // (Arcade, Playground) that bypass VitePress's SPA router.
    vite: {
        define: {
            __SITE_ROOT__: JSON.stringify(repoBase),
        },
        // Mermaid 11.17 added `fastdom` and its promise extension, both
        // CommonJS/UMD, which `withMermaid`'s own pre-bundle list does not
        // include yet. Without these the dev server serves them unconverted,
        // and the browser rejects Mermaid's default imports of them. Builds
        // are unaffected.
        optimizeDeps: {
            include: ['mermaid > fastdom', 'mermaid > fastdom/extensions/fastdom-promised.js'],
        },
    },

    themeConfig: {
        // Cross-site nav (Arcade / Docs / Playground / GitHub) is rendered by
        // the custom Layout via the nav-bar-content-before slot so the links
        // are plain <a> tags not intercepted by VitePress's SPA router.
        nav: [],

        // The site's name goes to the Arcade, as it does from the Arcade's
        // and the playground's navs. A target keeps VitePress's router from
        // taking the link as a page of the docs.
        logoLink: { link: `${siteBase}arcade/`, target: '_self' },

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
                    {
                        text: 'Principles',
                        items: [
                            { text: 'Overview', link: '/architecture/principles/' },
                            { text: 'Separation of Concerns', link: '/architecture/principles/separation-of-concerns' },
                            { text: 'Single Source of Truth', link: '/architecture/principles/single-source-of-truth' },
                            { text: 'Command-Query Separation', link: '/architecture/principles/command-query-separation' },
                            { text: 'Dependency Inversion', link: '/architecture/principles/dependency-inversion' },
                            { text: 'Composite Reuse', link: '/architecture/principles/composite-reuse' },
                            { text: 'Design by Contract', link: '/architecture/principles/design-by-contract' },
                            { text: 'Illegal States Unrepresentable', link: '/architecture/principles/illegal-states-unrepresentable' },
                            { text: 'Design for Testability', link: '/architecture/principles/design-for-testability' },
                        ],
                    },
                    { text: 'Heritage', link: '/architecture/heritage' },
                ],
            },
            {
                text: 'Building with MVT',
                items: [
                    { text: 'Quickstart', link: '/building-with-mvt/quickstart' },
                    { text: 'The Game Loop', link: '/building-with-mvt/the-game-loop' },
                    {
                        text: 'Simulating the World',
                        items: [
                            { text: 'Models', link: '/building-with-mvt/simulating-the-world/models' },
                            { text: 'Time Management', link: '/building-with-mvt/simulating-the-world/time-management' },
                            { text: 'Model Composition', link: '/building-with-mvt/simulating-the-world/model-composition' },
                        ],
                    },
                    {
                        text: 'Presenting the World',
                        items: [
                            { text: 'Views', link: '/building-with-mvt/presenting-the-world/views' },
                            { text: 'Bindings', link: '/building-with-mvt/presenting-the-world/bindings' },
                            { text: 'Declarative Views', link: '/building-with-mvt/presenting-the-world/declarative-views' },
                            { text: 'View Composition', link: '/building-with-mvt/presenting-the-world/view-composition' },
                            { text: 'Bindings in Depth', link: '/building-with-mvt/presenting-the-world/bindings-in-depth' },
                            { text: 'Presenting Collections', link: '/building-with-mvt/presenting-the-world/collections' },
                            { text: 'Sound and Music', link: '/building-with-mvt/presenting-the-world/sound' },
                            { text: 'Reading Layout Back', link: '/building-with-mvt/presenting-the-world/reading-layout' },
                        ],
                    },
                    {
                        text: 'Reacting to Changes',
                        items: [
                            { text: 'Why Polling', link: '/building-with-mvt/reacting-to-changes/why-polling' },
                            { text: 'Change Detection', link: '/building-with-mvt/reacting-to-changes/change-detection' },
                            { text: 'Computed Values', link: '/building-with-mvt/reacting-to-changes/computed-values' },
                            { text: 'Events and Signals', link: '/building-with-mvt/reacting-to-changes/events-and-signals' },
                        ],
                    },
                    {
                        text: 'Adding Visual Polish',
                        items: [
                            { text: 'Presentation State', link: '/building-with-mvt/adding-visual-polish/presentation-state' },
                            { text: 'Taming Complex Views', link: '/building-with-mvt/adding-visual-polish/taming-complex-views' },
                            { text: 'Reduced Motion', link: '/building-with-mvt/adding-visual-polish/reduced-motion' },
                        ],
                    },
                    {
                        text: 'Animating Transitions',
                        items: [
                            { text: 'Phase-Based Transitions', link: '/building-with-mvt/animating-transitions/phase-based-transitions' },
                            { text: 'Open-Ended Phases', link: '/building-with-mvt/animating-transitions/open-ended-phases' },
                            { text: 'Complex Sequences', link: '/building-with-mvt/animating-transitions/complex-sequences' },
                        ],
                    },
                    {
                        text: 'Iterating with Confidence',
                        items: [
                            { text: 'Testing', link: '/building-with-mvt/iterating-with-confidence/testing' },
                            { text: 'Testing Models', link: '/building-with-mvt/iterating-with-confidence/testing-models' },
                            { text: 'Testing Views', link: '/building-with-mvt/iterating-with-confidence/testing-views' },
                            { text: 'Visual Tests', link: '/building-with-mvt/iterating-with-confidence/visual-tests' },
                        ],
                    },
                    {
                        text: 'Avoiding Pitfalls',
                        items: [
                            { text: 'Common Mistakes', link: '/building-with-mvt/avoiding-pitfalls/common-mistakes' },
                        ],
                    },
                    {
                        text: 'Performance',
                        items: [
                            { text: 'Why Performance Matters', link: '/building-with-mvt/performance/why-performance-matters' },
                            { text: 'Hot Paths', link: '/building-with-mvt/performance/hot-paths' },
                            { text: 'Performance Measurements', link: '/building-with-mvt/performance/measurements' },
                            { text: 'Benchmarking Methods', link: '/building-with-mvt/performance/benchmarking-methods' },
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
                    { text: 'Skill: Code Review', link: '/ai-agents/skill-code-review' },
                    { text: 'Skill: Documentation', link: '/ai-agents/skill-documentation' },
                ],
            },
        ],

        search: {
            provider: 'local',
        },
    },
}));
