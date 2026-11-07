// The book's shape: its parts, chapters and appendices in reading order, the
// numbers its pages and headings carry, and where its old addresses now go.
// The config builds the sidebar, the titles and the redirects from this file.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DefaultTheme, MarkdownRenderer } from 'vitepress';

// ---------------------------------------------------------------------------
// The reading order
// ---------------------------------------------------------------------------

/** A group in the sidebar, and its pages, each a path from the docs' root without `.md`. */
interface SidebarGroup {
    readonly text: string;
    readonly pages: readonly string[];
    readonly collapsed?: boolean;
    /** Whether the group is about this repo rather than part of the book, so printing leaves it out. */
    readonly isOutsideBook?: boolean;
}

const BOOK: readonly SidebarGroup[] = [
    { text: 'Building Web Games with MVT', pages: ['index'] },
    {
        text: 'I. The Big Picture',
        pages: ['chapters/01-games-in-the-browser', 'chapters/02-why-mvt', 'chapters/03-a-first-game'],
    },
    {
        text: 'II. The Simulation',
        pages: ['chapters/04-models', 'chapters/05-the-tick', 'chapters/06-time-and-phases'],
    },
    {
        text: 'III. The Presentation',
        pages: [
            'chapters/07-views',
            'chapters/08-bindings',
            'chapters/09-noticing-changes',
            'chapters/10-why-views-poll',
            'chapters/11-presentation-state',
            'chapters/12-writing-views-in-jsx',
            'chapters/13-composing-views',
            'chapters/14-lists-and-switches',
        ],
    },
    {
        text: 'IV. Testing',
        pages: [
            'chapters/15-testing-models',
            'chapters/16-testing-views',
            'chapters/17-visual-tests',
        ],
    },
    {
        text: 'V. Advanced Presentation',
        pages: [
            'chapters/18-growing-a-complex-view',
            'chapters/19-lists-in-motion',
            'chapters/20-sound-and-music',
            'chapters/21-reading-layout-back',
            'chapters/22-reduced-motion',
        ],
    },
    {
        text: 'VI. Performance',
        pages: [
            'chapters/23-why-performance-matters',
            'chapters/24-hot-paths',
        ],
    },
    {
        text: 'VII. Principles Behind MVT',
        pages: [
            'chapters/25-the-eight-principles',
            'chapters/26-separation-of-concerns',
            'chapters/27-single-source-of-truth',
            'chapters/28-command-query-separation',
            'chapters/29-dependency-inversion',
            'chapters/30-composite-reuse',
            'chapters/31-design-by-contract',
            'chapters/32-make-illegal-states-unrepresentable',
            'chapters/33-design-for-testability',
            'chapters/34-using-the-principles',
        ],
    },
    { text: 'Conclusion', pages: ['chapters/conclusion'] },
    {
        text: 'Appendices',
        pages: [
            'appendices/a-mvt-on-one-page',
            'appendices/b-glossary',
            'appendices/c-measurements',
            'appendices/d-measuring-performance',
            'appendices/e-timelines-with-gsap',
            'appendices/f-troubleshooting',
            'appendices/g-api-cheat-sheets',
            'appendices/h-mvt-beyond-the-web',
            'appendices/i-why-update-and-refresh',
        ],
    },
    {
        text: 'Working in This Repo',
        collapsed: true,
        isOutsideBook: true,
        pages: [
            'working-in-this-repo/writing-guide',
            'working-in-this-repo/code-style',
            'working-in-this-repo/project-structure',
        ],
    },
];

/** The printed book's file name, in the docs' root. The print script writes it, and the site links to it. */
export const PRINTED_BOOK_FILE = 'building-web-games-with-mvt.pdf';

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * Returns what a page's numbers start with, from its file name: `8` for
 * `chapters/08-bindings.md`, and `A` for `appendices/a-mvt-on-one-page.md`.
 * Returns undefined for a page outside the numbered book, such as the
 * preface.
 */
export function toPagePrefix(relativePath: string): string | undefined {
    const chapter = /^chapters\/(\d+)-/.exec(relativePath);
    if (chapter) return String(Number(chapter[1]));
    const appendix = /^appendices\/([a-z])-/.exec(relativePath);
    return appendix === null ? undefined : appendix[1].toUpperCase();
}

/** Returns a page's title as the book shows it: `8. Bindings` for a chapter, and `A. MVT on One Page` for an appendix. */
export function toBookTitle(relativePath: string, title: string): string {
    const prefix = toPagePrefix(relativePath);
    return prefix === undefined ? title : `${prefix}. ${title}`;
}

/**
 * Numbers a chapter's or an appendix's examples that run, its experiments,
 * by giving each `<TryIt>` a label: Chapter 4's are Experiment 4A, 4B and
 * so on, and Appendix E's Experiment E1, E2.
 */
export function numberExperiments(md: MarkdownRenderer): void {
    md.core.ruler.push('number_experiments', (state) => {
        const prefix = toPagePrefix((state.env as { relativePath?: string }).relativePath ?? '');
        if (prefix === undefined) return;
        let count = 0;
        const label = (tag: string): string => `${tag} label="${toExperimentLabel(prefix, ++count)}"`;
        for (const token of state.tokens) {
            // VitePress makes a line that's only a component an html_inline token of its own
            if (token.type === 'html_block' || token.type === 'html_inline') token.content = token.content.replace(/<TryIt\b/g, label);
            for (const child of token.children ?? []) {
                if (child.type === 'html_inline') child.content = child.content.replace(/<TryIt\b/g, label);
            }
        }
    });
}

/** Returns an experiment's label from its page's prefix and its place on the page, counting from 1: "Experiment 4B", "Experiment E2". */
function toExperimentLabel(prefix: string, count: number): string {
    // A chapter's are lettered, as 4A, 4B; an appendix's numbered, as E1, E2
    const suffix = /^\d+$/.test(prefix) ? String.fromCharCode(64 + count) : String(count);
    return `Experiment ${prefix}${suffix}`;
}

/** The start of a `<CheatSheet>` tag, which writes headings of its own. */
const CHEAT_SHEET_TAG = /<CheatSheet\b/g;

/**
 * Numbers a page's headings from its file name, as it is rendered: the
 * title of Chapter 7 shows `7.`, each `##` heading 7.1, 7.2 and so on, and
 * each `###` heading 7.1.1. Deeper headings are not numbered. The numbers
 * are not part of the heading's text, so its anchor stays the same when
 * sections are added or moved. A `<CheatSheet>` writes `###` headings of
 * its own, so it's given its section's number, as `section-number`, to
 * number them from.
 */
export function numberHeadings(md: MarkdownRenderer): void {
    md.core.ruler.push('number_headings', (state) => {
        const relativePath = (state.env as { relativePath?: string }).relativePath ?? '';
        const prefix = toPagePrefix(relativePath);
        if (prefix === undefined) return;
        let hasTitle = false;
        let section = 0;
        let subsection = 0;
        for (const token of state.tokens) {
            if (section > 0) {
                // VitePress makes a line that's only a component an html_inline token of its own
                const numbered = `$& section-number="${prefix}.${section}"`;
                if (token.type === 'html_block' || token.type === 'html_inline') token.content = token.content.replace(CHEAT_SHEET_TAG, numbered);
                for (const child of token.children ?? []) {
                    if (child.type === 'html_inline') child.content = child.content.replace(CHEAT_SHEET_TAG, numbered);
                }
            }
            if (token.type !== 'heading_open') continue;
            let headingNumber: string | undefined;
            if (token.tag === 'h1') {
                // Only the page's first heading is its title
                if (!hasTitle) headingNumber = `${prefix}.`;
                hasTitle = true;
            }
            else if (token.tag === 'h2') {
                section++;
                subsection = 0;
                headingNumber = `${prefix}.${section}`;
            }
            else if (token.tag === 'h3' && section > 0) {
                subsection++;
                headingNumber = `${prefix}.${section}.${subsection}`;
            }
            if (headingNumber !== undefined) token.meta = { ...token.meta, headingNumber };
        }
    });

    const renderOpen = md.renderer.rules.heading_open
        ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
    md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
        const html = renderOpen(tokens, idx, options, env, self);
        const headingNumber = (tokens[idx].meta as { headingNumber?: string } | null)?.headingNumber;
        return headingNumber === undefined ? html : `${html}<span class="heading-number">${headingNumber}</span> `;
    };
}

// ---------------------------------------------------------------------------
// Section references
// ---------------------------------------------------------------------------

/**
 * Fills in a link written `[§](08-bindings.md#query-bindings)` with the
 * section's number and heading, such as "8.2 Query Bindings", as the page
 * is built. A link with no `#section` names the chapter or appendix:
 * "Chapter 8" or "Appendix A". A link to `#try-`
 * and an example's name, such as `[§](#try-door-slide)`, names the
 * experiment that runs it: "Experiment 9A". So a reference stays right when
 * sections or experiments are added, moved or renumbered. A reference that
 * can't be resolved keeps its `§`, and the build says so.
 */
export function fillSectionReferences(md: MarkdownRenderer): void {
    md.core.ruler.push('fill_section_references', (state) => {
        const relativePath = (state.env as { relativePath?: string }).relativePath ?? '';
        const here = posix.dirname(relativePath);
        for (const block of state.tokens) {
            const children = block.children;
            if (block.type !== 'inline' || children === null) continue;
            for (let i = 0; i + 2 < children.length; i++) {
                const text = children[i + 1];
                if (children[i].type !== 'link_open' || text.type !== 'text' || text.content !== '§') continue;
                if (children[i + 2].type !== 'link_close') continue;
                const href = children[i].attrGet('href') ?? '';
                const [path, anchor = ''] = href.split('#');
                let target = path === '' ? relativePath : posix.normalize(posix.join(here, path));
                if (!target.endsWith('.md')) target += '.md';
                const label = toSectionLabel(target, anchor);
                if (label === undefined) {
                    console.warn(`[book] ${relativePath}: no section for [§](${href})`);
                }
                else {
                    text.content = label;
                }
            }
        }
    });
}

/** A page's numbered headings, by anchor, as read from its file, and when that file was last changed. */
interface SectionLabels {
    readonly changedMs: number;
    readonly labels: ReadonlyMap<string, string>;
}

const sectionLabelCache = new Map<string, SectionLabels>();

/**
 * Returns how a reference to a page's section reads: its number and heading
 * for a section, or the page's own name for no section. Returns undefined
 * if the page or the section doesn't exist.
 */
function toSectionLabel(target: string, anchor: string): string | undefined {
    const file = join(DOCS_ROOT, target);
    if (!existsSync(file)) return undefined;
    const prefix = toPagePrefix(target);
    if (anchor === '') {
        if (prefix === undefined) return readTitle(target.replace(/\.md$/, ''));
        return target.startsWith('chapters/') ? `Chapter ${prefix}` : `Appendix ${prefix}`;
    }
    const changedMs = statSync(file).mtimeMs;
    let cached = sectionLabelCache.get(target);
    if (cached?.changedMs !== changedMs) {
        cached = { changedMs, labels: readSectionLabels(readFileSync(file, 'utf-8'), prefix) };
        sectionLabelCache.set(target, cached);
    }
    return cached.labels.get(anchor);
}

/**
 * Returns each heading's label by its anchor, numbered as `numberHeadings`
 * numbers them, from the page's Markdown. Anchors follow VitePress's slugs,
 * with `-1`, `-2` added to repeats. Each experiment's label is there too, as
 * `numberExperiments` numbers them, by its anchor: `try-` and its example's
 * name.
 */
function readSectionLabels(markdown: string, prefix: string | undefined): Map<string, string> {
    const labels = new Map<string, string>();
    const seen = new Map<string, number>();
    let inFence = false;
    let section = 0;
    let subsection = 0;
    let experiments = 0;
    for (const line of markdown.split(/\r?\n/)) {
        if (/^(```|~~~)/.test(line)) inFence = !inFence;
        const experiment = inFence || prefix === undefined ? null : /<TryIt\b[^>]*\bexample="([^"]+)"/.exec(line);
        if (experiment !== null) labels.set(`try-${experiment[1]}`, toExperimentLabel(prefix, ++experiments));
        const heading = inFence ? null : /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
        if (heading === null) continue;
        const level = heading[1].length;
        const text = toPlainHeading(heading[2]);
        const slug = toSlug(text);
        const repeats = seen.get(slug) ?? 0;
        seen.set(slug, repeats + 1);
        const anchor = repeats === 0 ? slug : `${slug}-${repeats}`;
        let headingNumber: string | undefined;
        if (level === 2) {
            section++;
            subsection = 0;
            headingNumber = `${prefix}.${section}`;
        }
        else if (level === 3 && section > 0) {
            subsection++;
            headingNumber = `${prefix}.${section}.${subsection}`;
        }
        labels.set(anchor, prefix !== undefined && headingNumber !== undefined ? `${headingNumber} ${text}` : text);
    }
    return labels;
}

/** Returns a heading's text without its Markdown: code spans, links, emphasis and tags. */
function toPlainHeading(heading: string): string {
    // Tags are stripped outside code spans only: `<List>` in a heading is text
    return heading
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .split('`')
        .map((part, i) => (i % 2 === 0 ? part.replace(/<[^>]+>/g, '') : part))
        .join('')
        .replace(/\*/g, '')
        .trim();
}

/** Returns a heading's anchor, as VitePress makes it (the slugify of `@mdit-vue/shared`). */
function toSlug(text: string): string {
    return text
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[\u0000-\u001f]/g, '')
        .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/^(\d)/, '_$1')
        .toLowerCase();
}

// ---------------------------------------------------------------------------
// The sidebar
// ---------------------------------------------------------------------------

const DOCS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Returns the text of a page's first `#` heading. */
function readTitle(page: string): string {
    const text = readFileSync(join(DOCS_ROOT, `${page}.md`), 'utf-8');
    const heading = /^# (.+)$/m.exec(text);
    return heading ? heading[1].trim() : page;
}

/** Returns a page's text in the sidebar: its book title, such as "8. Bindings". */
function toSidebarText(page: string): string {
    return page === 'index' ? 'Preface' : toBookTitle(`${page}.md`, readTitle(page));
}

/**
 * Returns the book's parts and appendices, each with its pages, in reading
 * order, as a printed copy has them: without the pages for working in this
 * repo. Each page's text is as the sidebar shows it, such as "8. Bindings".
 */
export function listPrintedBook(): { readonly text: string; readonly pages: readonly { readonly page: string; readonly text: string }[] }[] {
    return BOOK.filter((group) => group.isOutsideBook !== true).map((group) => ({
        text: group.text,
        pages: group.pages.map((page) => ({ page, text: toSidebarText(page) })),
    }));
}

/**
 * Returns the sidebar: the book's parts, its appendices, then the pages for
 * working in this repo. The first group, after the Preface, links to the
 * printed book at `printedBookHref`. VitePress adds its base only to links to
 * pages, so the address must include it.
 */
export function createSidebar(printedBookHref: string): DefaultTheme.SidebarItem[] {
    return BOOK.map((group, index) => ({
        text: group.text,
        collapsed: group.collapsed,
        items: [
            ...group.pages.map((page) => ({
                text: toSidebarText(page),
                link: page === 'index' ? '/' : `/${page}`,
            })),
            ...(index === 0 ? [{ text: 'The Book as a PDF', link: printedBookHref }] : []),
        ],
    }));
}

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

/** Where each page that has moved now lives, as paths from the docs' root without `.md`. */
const REDIRECTS: Readonly<Record<string, string>> = {
    'architecture/index': 'chapters/02-why-mvt',
    'architecture/models': 'chapters/04-models',
    'architecture/views': 'chapters/07-views',
    'architecture/bindings': 'chapters/08-bindings',
    'architecture/ticker': 'chapters/05-the-tick',
    'architecture/rules': 'appendices/a-mvt-on-one-page',
    'architecture/heritage': 'chapters/02-why-mvt',
    'architecture/principles/index': 'chapters/25-the-eight-principles',
    'architecture/principles/separation-of-concerns': 'chapters/26-separation-of-concerns',
    'architecture/principles/single-source-of-truth': 'chapters/27-single-source-of-truth',
    'architecture/principles/command-query-separation': 'chapters/28-command-query-separation',
    'architecture/principles/dependency-inversion': 'chapters/29-dependency-inversion',
    'architecture/principles/composite-reuse': 'chapters/30-composite-reuse',
    'architecture/principles/design-by-contract': 'chapters/31-design-by-contract',
    'architecture/principles/illegal-states-unrepresentable': 'chapters/32-make-illegal-states-unrepresentable',
    'architecture/principles/design-for-testability': 'chapters/33-design-for-testability',
    'building-with-mvt/quickstart': 'chapters/03-a-first-game',
    'building-with-mvt/the-game-loop': 'chapters/05-the-tick',
    'building-with-mvt/simulating-the-world/models': 'chapters/04-models',
    'building-with-mvt/simulating-the-world/time-management': 'chapters/06-time-and-phases',
    'building-with-mvt/simulating-the-world/model-composition': 'chapters/04-models',
    'building-with-mvt/presenting-the-world/views': 'chapters/07-views',
    'building-with-mvt/presenting-the-world/bindings': 'chapters/08-bindings',
    'building-with-mvt/presenting-the-world/declarative-views': 'chapters/12-writing-views-in-jsx',
    'building-with-mvt/presenting-the-world/view-composition': 'chapters/13-composing-views',
    'building-with-mvt/presenting-the-world/bindings-in-depth': 'chapters/08-bindings',
    'building-with-mvt/presenting-the-world/collections': 'chapters/14-lists-and-switches',
    'building-with-mvt/presenting-the-world/sound': 'chapters/20-sound-and-music',
    'building-with-mvt/presenting-the-world/reading-layout': 'chapters/21-reading-layout-back',
    'building-with-mvt/reacting-to-changes/why-polling': 'chapters/10-why-views-poll',
    'building-with-mvt/reacting-to-changes/change-detection': 'chapters/09-noticing-changes',
    'building-with-mvt/reacting-to-changes/computed-values': 'chapters/09-noticing-changes',
    'building-with-mvt/reacting-to-changes/events-and-signals': 'chapters/10-why-views-poll',
    'building-with-mvt/adding-visual-polish/presentation-state': 'chapters/11-presentation-state',
    'building-with-mvt/adding-visual-polish/taming-complex-views': 'chapters/18-growing-a-complex-view',
    'building-with-mvt/adding-visual-polish/reduced-motion': 'chapters/22-reduced-motion',
    'building-with-mvt/animating-transitions/phase-based-transitions': 'chapters/06-time-and-phases',
    'building-with-mvt/animating-transitions/open-ended-phases': 'chapters/06-time-and-phases',
    'building-with-mvt/animating-transitions/complex-sequences': 'chapters/18-growing-a-complex-view',
    'building-with-mvt/iterating-with-confidence/testing': 'chapters/15-testing-models',
    'building-with-mvt/iterating-with-confidence/testing-models': 'chapters/15-testing-models',
    'building-with-mvt/iterating-with-confidence/testing-views': 'chapters/16-testing-views',
    'building-with-mvt/iterating-with-confidence/visual-tests': 'chapters/17-visual-tests',
    'building-with-mvt/avoiding-pitfalls/common-mistakes': 'appendices/f-troubleshooting',
    'building-with-mvt/performance/why-performance-matters': 'chapters/23-why-performance-matters',
    'building-with-mvt/performance/hot-paths': 'chapters/24-hot-paths',
    'building-with-mvt/performance/measurements': 'appendices/c-measurements',
    'building-with-mvt/performance/benchmarking-methods': 'appendices/d-measuring-performance',
    'reference/architecture-rules': 'appendices/a-mvt-on-one-page',
    'reference/style-guide': 'working-in-this-repo/code-style',
    'reference/glossary': 'appendices/b-glossary',
    'reference/project-structure': 'working-in-this-repo/project-structure',
    'contributing': 'working-in-this-repo/writing-guide',
};

/**
 * Writes a small page at each old address, which sends the reader on to the
 * page's new address, keeping any `#section` in the link. It runs once the
 * pages are built, and carries the new page's link preview, since a chat app
 * builds a preview from the tags of the page it was given, without following
 * it on.
 */
export function writeRedirects(options: { readonly outDir: string; readonly base: string }): void {
    const { outDir, base } = options;
    for (const [from, to] of Object.entries(REDIRECTS)) {
        const target = `${base}${to}.html`;
        const previewTags = readFileSync(join(outDir, `${to}.html`), 'utf8').match(/<meta (?:property="og:|name="twitter:)[^>]*>/g) ?? [];
        const html = '<!doctype html>\n<meta charset="utf-8">\n<title>This page has moved</title>\n'
            + previewTags.map((tag) => `${tag}\n`).join('')
            + `<link rel="canonical" href="${target}">\n`
            + `<meta http-equiv="refresh" content="0; url=${target}">\n`
            + `<script>location.replace(${JSON.stringify(target)} + location.hash);</script>\n`
            + `<p>This page has moved to <a href="${target}">${target}</a>.</p>\n`;
        const file = join(outDir, `${from}.html`);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, html);
    }
}
