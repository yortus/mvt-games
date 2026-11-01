import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { createSidebar, fillSectionReferences, numberExperiments, numberHeadings, PRINTED_BOOK_FILE, toBookTitle, writeRedirects } from './book';
import { createSearchRender } from './search-render';

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
// (packages/sites/site-kit/scripts/share-image.ts).
const shareImage = {
    url: `${siteOrigin}${siteBase}arcade/share.jpg`,
    width: 1200,
    height: 630,
    alt: 'The MVT Arcade\'s wall of cards, one for each game and demo',
};

export default withMermaid(defineConfig({
    // The site's name, shared with the Arcade and the playground. The book's
    // own title, Building Web Games with MVT, heads its preface and sidebar.
    title: 'MVT Games',
    description: 'Building Web Games with MVT: a book about the Model-View-Ticker architecture for games that run in the browser, with examples that run in the page.',
    base,
    outDir: '../../../dist/docs',
    // articles/ holds drafts that are not published yet, and ai-agents/ holds
    // the skills for AI agents, which link into the book but aren't part of it.
    srcExclude: ['articles/**', 'ai-agents/**'],
    ignoreDeadLinks: [
        /^\/playground\//,
    ],

    // Numbers each page's headings and experiments from its file name, and
    // fills in each `[§](page#section)` link with that section's number and
    // heading (book.ts)
    markdown: {
        config: (md) => {
            md.use(numberHeadings);
            md.use(numberExperiments);
            md.use(fillSectionReferences);
            // A line break within a paragraph is a space. Left as a line
            // break, Vue drops it between two elements, as between a bold
            // phrase ending one line and a link starting the next
            md.renderer.rules.softbreak = () => ' ';
        },
    },

    // A chapter's title carries its number: "8. Bindings"
    transformPageData(pageData) {
        pageData.title = toBookTitle(pageData.relativePath, pageData.title);
    },

    // Keeps the book's old addresses working (book.ts)
    buildEnd(siteConfig) {
        writeRedirects({ outDir: siteConfig.outDir, base: siteConfig.site.base });
    },

    appearance: 'dark',

    // What a link to a page shows when it is shared: the page's own title,
    // summary and address, with the site's picture. Sites that build link
    // previews read these tags, and no page sets them itself.
    transformHead({ pageData, siteData }) {
        // The address VitePress serves the page at: `chapters/08-bindings.html`, or `/` for an index
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
    // (Arcade, Playground) that bypass VitePress's SPA router, and
    // __SITE_ORIGIN__ so a printed page can say where it is online.
    vite: {
        define: {
            __SITE_ROOT__: JSON.stringify(repoBase),
            __SITE_ORIGIN__: JSON.stringify(siteOrigin),
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

        // The book: its parts, its appendices and the pages for working in
        // this repo, in reading order, with a link to the printed book (book.ts)
        sidebar: createSidebar(`${base}${PRINTED_BOOK_FILE}`),

        // Appendix G's cheat sheets are written out for the index, since
        // the search doesn't run the component that draws them
        search: {
            provider: 'local',
            options: { _render: createSearchRender() },
        },
    },
}));
