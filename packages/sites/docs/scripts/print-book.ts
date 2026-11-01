// Prints the book to a PDF, typeset as a book, from the built site. Run it
// after `npm run build` (or the docs' and playground's own builds):
// `npm run print -w @mvtjs/docs`.
//
// It serves dist/ on a local port, and opens each page of the book in reading
// order in Playwright's headless browser. Once a page has drawn its diagrams,
// it takes the page's content, as the site rendered it: headings numbered,
// section references filled in, code highlighted, and each example's still in
// place of the example. It leaves the site's styles behind. It joins the pages
// into one document, with a half title, a title page, contents and a page for
// each part, and gives each chapter an opening. A link to another chapter
// gives the page it goes to, and a link out of the book becomes a footnote
// with its address.
//
// Paged.js then lays the document out into pages, by the book's own
// stylesheet, print-book.css: running heads, page numbers, the contents' page
// numbers, and each part and chapter on a right-hand page. print-book-breaks.js
// moves a break where Paged.js would strand a heading or a line. The browser
// prints those pages.
//
// It writes dist/docs/building-web-games-with-mvt.pdf, which the site's deploy
// publishes beside the docs, and which the Preface and the sidebar link to.
// The document it lays out is served from memory, as
// `<site root>docs/print.html`, so it leaves no page in dist/ that the site
// would publish.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, extname, join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import { listPrintedBook, PRINTED_BOOK_FILE } from '../.vitepress';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST = resolve(import.meta.dirname, '../../../../dist');

/** The site's root, as the build was given it: `/`, or such as `/mvt-games/`. */
const SITE_ROOT = withSlash(process.env.BASE_URL ?? '/');

/** Where a printed link to the site goes, such as `https://example.com`. Without one, links name paths only. */
const SITE_ORIGIN = process.env.SITE_ORIGIN ?? '';

const TITLE = 'Building Web Games with MVT';
const SUBTITLE = 'The Model-View-Ticker architecture for games';

const PDF_PATH = join(DIST, 'docs', PRINTED_BOOK_FILE);
/** Where the document to lay out is served, beside the pages, so their relative links still work. */
const DOCUMENT_PATH = `${SITE_ROOT}docs/print.html`;

/** What the server serves from memory, by path: the document, once it's made. */
const DOCUMENTS = new Map<string, string>();

/** The book's stylesheet. */
const STYLES = readFileSync(join(import.meta.dirname, 'print-book.css'), 'utf8');

/** Where the server finds the fonts and Paged.js: `/__print/<package>/<file>` is the file in that package. */
const PRINT_PATH = '/__print/';
const PACKAGES = ['pagedjs', '@fontsource-variable/source-serif-4', '@fontsource-variable/source-sans-3', '@fontsource-variable/source-code-pro'];

/** The book's fonts: Latin only, each a variable font. */
const FONTS: readonly { readonly family: string; readonly file: string; readonly style: 'normal' | 'italic' }[] = [
    { family: 'Source Serif 4 Variable', file: 'source-serif-4/files/source-serif-4-latin-opsz-normal.woff2', style: 'normal' },
    { family: 'Source Serif 4 Variable', file: 'source-serif-4/files/source-serif-4-latin-opsz-italic.woff2', style: 'italic' },
    { family: 'Source Sans 3 Variable', file: 'source-sans-3/files/source-sans-3-latin-wght-normal.woff2', style: 'normal' },
    { family: 'Source Sans 3 Variable', file: 'source-sans-3/files/source-sans-3-latin-wght-italic.woff2', style: 'italic' },
    { family: 'Source Code Pro Variable', file: 'source-code-pro/files/source-code-pro-latin-wght-normal.woff2', style: 'normal' },
];

/** The width of a page's text, as print-book.css's page size and margins leave it. */
const TEXT_WIDTH = '143.5mm';

/** The most layouts the pages may take to settle. */
const MAX_PASSES = 8;

/** The least of its page a chapter's last page fills, as a share of the page. Less, and the page before breaks earlier. */
const MIN_LAST_PAGE_FILL = 0.25;

/** The least of its page the page before a chapter's last page keeps, when it breaks earlier to fill that one. */
const MIN_EARLIER_PAGE_FILL = 0.55;

/** How long a page may take to draw its diagrams. */
const DIAGRAM_WAIT_MS = 15_000;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

// ---------------------------------------------------------------------------
// The script
// ---------------------------------------------------------------------------

if (!existsSync(join(DIST, 'docs/index.html'))) {
    throw new Error(`There is no built site in ${DIST}. Build it first: npm run build`);
}

const server = await serve(DIST);
const origin = `http://localhost:${(server.address() as AddressInfo).port}`;
const docsUrl = `${origin}${SITE_ROOT}docs/`;
const browser = await chromium.launch();
try {
    const context = await browser.newContext({ colorScheme: 'light' });
    // The site remembers the reader's theme; a printed copy is always light
    await context.addInitScript(() => localStorage.setItem('vitepress-theme-appearance', 'light'));
    // tsx wraps a function declared inside another in a helper, __name, which
    // the functions this script runs in the page would need there too
    await context.addInitScript({ content: 'window.__name = (fn) => fn;' });
    const page = await context.newPage();

    const book = listPrintedBook();
    const sections: string[] = [];
    let partCount = 0;
    for (const group of book) {
        const pages = group.pages.map(toEntry);
        // A group of unnumbered pages, the preface or the conclusion, doesn't have a part's page
        const isUnnumbered = pages.every((entry) => entry.number === undefined);
        if (!isUnnumbered) {
            const part = toPart(group.text);
            const firstClass = partCount === 0 ? ' first-part' : '';
            sections.push(`<section class="part${firstClass}" id="${toPartId(group.text)}">${part.label === undefined ? '' : `<p class="part-label">${part.label}</p>`}<h1>${escapeHtml(part.title)}</h1></section>`);
            partCount++;
        }
        for (const entry of pages) {
            const url = toPageUrl(entry.page);
            const html = await readPage(page, url);
            const kindClass = entry.kind === 'preface' ? ' front-matter' : '';
            sections.push(`<section class="chapter${kindClass}" id="${toPageId(entry.page)}" data-url="${url}" data-label="${escapeHtml(entry.label ?? '')}" data-title="${escapeHtml(entry.title)}">${html}</section>`);
        }
    }

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${TITLE}</title>
<style>${toFontFaces()}</style>
<style>${STYLES}</style>
</head>
<body>
<section class="title-matter half-title"><h1>${TITLE}</h1></section>
<section class="title-matter title-page"><h1>${TITLE}</h1><p class="subtitle">${SUBTITLE}</p></section>
<section class="title-matter colophon">${toColophon()}</section>
${toContents(book)}
${sections.join('\n')}
</body>
</html>`;
    DOCUMENTS.set(DOCUMENT_PATH, html);

    // A page reference's number is part of its text before the pages are
    // laid out, so the text never grows afterwards and pushes lines off a
    // finished page. The first layout finds where each target lands; the
    // next writes those pages in, and so on until they stop moving. A
    // chapter whose last page would be nearly empty starts that page earlier,
    // in the next layout.
    const pageIds = Object.fromEntries(book.flatMap((g) => g.pages.map((p) => [p.page, toPageId(p.page)])));
    let pageNumbers: Readonly<Record<string, string>> = {};
    const breaksBefore = new Set<number>();
    let layout: Layout;
    for (let pass = 1; ; pass++) {
        layout = await layOut(page, { docsPath: `${SITE_ROOT}docs/`, siteOrigin: SITE_ORIGIN, pageIds, pageNumbers, breaksBefore: [...breaksBefore] });
        const newBreaks = layout.breaksBefore.filter((block) => !breaksBefore.has(block));
        if (isSameNumbers(layout.pageNumbers, pageNumbers) && newBreaks.length === 0) break;
        if (pass === MAX_PASSES) throw new Error(`The pages still moved after ${MAX_PASSES} layouts`);
        pageNumbers = layout.pageNumbers;
        for (const block of newBreaks) breaksBefore.add(block);
    }

    await page.pdf({ path: PDF_PATH, preferCSSPageSize: true, printBackground: true });
    console.log(`Printed ${PDF_PATH}: ${layout.total} pages`);
    // After the PDF is written, so its pages can be looked at
    if (layout.hidden.length > 0) throw new Error(`Text outside its page, which is lost from the PDF:\n${layout.hidden.join('\n')}`);
}
finally {
    await browser.close();
    server.close();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A page of the book, as the contents and its opening name it. */
interface BookEntry {
    readonly page: string;
    readonly kind: 'preface' | 'chapter' | 'appendix';
    /** Its number, such as "7" or "A". */
    readonly number: string | undefined;
    /** What its opening calls it, above its title, such as "Chapter 7". */
    readonly label: string | undefined;
    readonly title: string;
}

/** Reads a page's sidebar text, such as "8. Bindings" or "A. MVT on One Page". */
function toEntry({ page, text }: { readonly page: string; readonly text: string }): BookEntry {
    if (page === 'index') return { page, kind: 'preface', number: undefined, label: undefined, title: 'Preface' };
    const numbered = /^(\d+|[A-Z])\.\s+(.*)$/.exec(text);
    if (numbered !== null) {
        const [, number, title] = numbered;
        const isChapter = /^\d+$/.test(number);
        return { page, kind: isChapter ? 'chapter' : 'appendix', number, label: `${isChapter ? 'Chapter' : 'Appendix'} ${number}`, title };
    }
    return { page, kind: 'chapter', number: undefined, label: undefined, title: text };
}

/** Reads a part's sidebar text, such as "II. The Simulation", into its label and title. */
function toPart(text: string): { readonly label: string | undefined; readonly title: string } {
    const match = /^([IVX]+)\.\s+(.*)$/.exec(text);
    return match === null ? { label: undefined, title: text } : { label: `Part ${match[1]}`, title: match[2] };
}

/**
 * Serves a folder, as the site is served (`<site root>docs/...` from
 * `dist/docs/...`), the print's packages, under `/__print/`, and the
 * documents made in memory.
 */
function serve(folder: string): Promise<Server> {
    const packageFolders = new Map(PACKAGES.map((name) => [name, findPackage(name)]));
    return new Promise((resolveServer) => {
        const server = createServer((request, response) => {
            const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
            const document = DOCUMENTS.get(pathname);
            if (document !== undefined) {
                response.writeHead(200, { 'Content-Type': 'text/html' });
                response.end(document);
                return;
            }
            let file: string | undefined;
            if (pathname.startsWith(PRINT_PATH)) {
                const rest = pathname.slice(PRINT_PATH.length);
                const name = PACKAGES.find((p) => rest.startsWith(`${p}/`));
                const packageFolder = name === undefined ? undefined : packageFolders.get(name);
                if (name !== undefined && packageFolder !== undefined) file = join(packageFolder, rest.slice(name.length + 1));
            }
            else {
                const relative = pathname.startsWith(SITE_ROOT) ? pathname.slice(SITE_ROOT.length) : pathname.slice(1);
                file = join(folder, relative);
                if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
            }
            if (file === undefined || !existsSync(file)) {
                response.writeHead(404);
                response.end();
                return;
            }
            response.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' });
            createReadStream(file).pipe(response);
        });
        // Port 0 lets the system choose a free one
        server.listen(0, () => resolveServer(server));
    });
}

/** Finds an installed package's folder, in the nearest node_modules that has it. */
function findPackage(name: string): string {
    for (let folder = import.meta.dirname; ; folder = dirname(folder)) {
        const candidate = join(folder, 'node_modules', name);
        if (existsSync(candidate)) return candidate;
        if (dirname(folder) === folder) throw new Error(`${name} is not installed. Run npm install`);
    }
}

/** What prepareBook needs to know. */
interface PrepareOptions {
    /** Where the docs are on the site, such as `/docs/`. */
    readonly docsPath: string;
    readonly siteOrigin: string;
    /** Each page's id in the document, by its path, such as `chapters/08-bindings`. */
    readonly pageIds: Readonly<Record<string, string>>;
    /** The page each link's target was on in the last layout, by its id. */
    readonly pageNumbers: Readonly<Record<string, string>>;
    /** The blocks a page starts before, by their number in the book. */
    readonly breaksBefore: readonly number[];
}

/** The book, laid out into pages. */
interface Layout {
    readonly total: number;
    /** The page each target of a link within the book is on, as it's printed, by its id. */
    readonly pageNumbers: Readonly<Record<string, string>>;
    /** Text outside its page's area, by page, which would be lost. */
    readonly hidden: readonly string[];
    /** Blocks to start a page before, so that a chapter's last page isn't nearly empty. */
    readonly breaksBefore: readonly number[];
}

/**
 * Opens the document, prepares it with the page numbers known so far, and
 * lays it out. Then it numbers the pages, finds the page each link's target
 * is on, and checks that no text is outside its page.
 */
async function layOut(page: Page, options: PrepareOptions): Promise<Layout> {
    await page.goto(`${docsUrl}print.html`, { waitUntil: 'networkidle' });
    await page.evaluate(prepareBook, options);
    await page.evaluate(async () => {
        // Each image's size is known before the layout, so none grows once
        // its page is laid out, pushing lines off it
        await Promise.all([...document.images].map(async (image) => {
            await image.decode().catch(() => undefined);
            image.width = image.naturalWidth;
            image.height = image.naturalHeight;
        }));
        const faces = ['400 1em "Source Serif 4 Variable"', 'italic 400 1em "Source Serif 4 Variable"', '600 1em "Source Sans 3 Variable"', 'italic 400 1em "Source Sans 3 Variable"', '400 1em "Source Code Pro Variable"'];
        await Promise.all(faces.map((face) => document.fonts.load(face)));
    });
    await page.evaluate(setTablesAsRows, TEXT_WIDTH);

    // Paged.js lays the pages out once it's asked to, not as it loads
    await page.evaluate(() => {
        (window as { PagedConfig?: object }).PagedConfig = { auto: false };
    });
    await page.addScriptTag({ url: `${PRINT_PATH}pagedjs/dist/paged.polyfill.js` });
    // The book's own rules for where a page may break: headings kept with
    // their sections, no widows or orphans, and nothing lost
    await page.addScriptTag({ path: join(import.meta.dirname, 'print-book-breaks.js') });
    return page.evaluate(async ({ MIN_LAST_PAGE_FILL_IN_PAGE, MIN_EARLIER_PAGE_FILL_IN_PAGE }) => {
        const previewer = (window as unknown as { PagedPolyfill: { preview: () => Promise<{ total: number }> } }).PagedPolyfill;
        const flow = await previewer.preview();
        // Paged.js starts the numbers again at Part I by resetting the counter
        // on that one page, but the browser no longer carries a reset on to the
        // pages after it. So each page is given its own number: from i in the
        // front matter, and from 1 at Part I.
        const pages = [...document.querySelectorAll<HTMLElement>('.pagedjs_page')];
        const firstBodyPage = pages.findIndex((p) => p.querySelector('.first-part') !== null);
        const romans = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i'];
        const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
        const numberOf = (index: number): string => {
            if (index >= firstBodyPage) return String(index - firstBodyPage + 1);
            let rest = index + 1;
            let roman = '';
            for (let i = 0; i < values.length; i++) {
                while (rest >= values[i]) {
                    roman += romans[i];
                    rest -= values[i];
                }
            }
            return roman;
        };
        pages.forEach((p, i) => {
            p.style.counterIncrement = 'none';
            p.style.counterReset = `page ${i < firstBodyPage ? i + 1 : i - firstBodyPage + 1}`;
        });

        const pageNumbers: Record<string, string> = {};
        for (const reference of document.querySelectorAll<HTMLElement>('[data-target]')) {
            const id = reference.dataset.target ?? '';
            const target = document.getElementById(id);
            const targetPage = target?.closest('.pagedjs_page');
            if (targetPage !== null && targetPage !== undefined) pageNumbers[id] = numberOf(pages.indexOf(targetPage as HTMLElement));
        }

        // Any text outside its page's area is hidden, and lost: below it, or
        // beside it, since Paged.js lays a page out as columns, and anything
        // the browser moves into a second column is past the page's end
        const hidden: string[] = [];
        for (const p of pages) {
            const area = p.querySelector('.pagedjs_page_content');
            if (area === null) continue;
            const { bottom, right } = area.getBoundingClientRect();
            const walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
                if ((node.textContent ?? '').trim() === '' || node.parentElement?.closest('svg') !== null) continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                const rects = [...range.getClientRects()];
                if (rects.some((rect) => rect.height > 0 && (rect.top >= bottom - 1 || rect.left >= right - 1))) {
                    hidden.push(`page ${numberOf(pages.indexOf(p))}: ${(node.textContent ?? '').trim().slice(0, 60)}`);
                    break;
                }
            }
        }
        // A chapter whose last page is nearly empty starts it earlier: before
        // a block near the foot of the page before, which leaves that page
        // well filled and moves enough to fill the last one
        const breaks: number[] = [];
        const bodyOf = (p: Element) => p.querySelector('.pagedjs_page_content')?.getBoundingClientRect();
        const bottomOf = (p: Element, area: DOMRect) => Math.max(area.top, ...[...p.querySelectorAll('[data-block]')]
            .map((block) => block.getBoundingClientRect())
            .filter((rect) => rect.left < area.right - 1)
            .map((rect) => Math.min(rect.bottom, area.bottom)));
        const isHeadingOrIntro = (element: Element | undefined) => element !== undefined
            && (element.matches('h1, h2, h3, h4, h5, header') || (element.matches('p') && (element.textContent ?? '').trim().endsWith(':')));
        // The block before, or for a list's first item, the block before the list
        const previousOf = (element: Element): Element | undefined => element.previousElementSibling
            ?? (element.matches('li') ? element.parentElement?.previousElementSibling : undefined)
            ?? undefined;
        for (let i = 1; i < pages.length; i++) {
            const last = pages[i];
            const next = pages[i + 1];
            const endsChapter = next === undefined || next.querySelector('.chapter-head, .part') !== null || next.querySelector('[data-block]') === null;
            const area = bodyOf(last);
            if (!endsChapter || area === undefined || last.querySelector('[data-block]') === null || last.querySelector('.chapter-head') !== null) continue;
            const fill = (bottomOf(last, area) - area.top) / area.height;
            if (fill >= MIN_LAST_PAGE_FILL_IN_PAGE) continue;
            const before = pages[i - 1];
            const beforeArea = bodyOf(before);
            if (beforeArea === undefined) continue;
            const beforeBottom = bottomOf(before, beforeArea);
            const candidates = [...before.querySelectorAll<HTMLElement>('[data-block]')].filter((block) => block.dataset.splitFrom === undefined).reverse();
            for (const block of candidates) {
                const top = block.getBoundingClientRect().top;
                if (top - beforeArea.top < MIN_EARLIER_PAGE_FILL_IN_PAGE * beforeArea.height) break;
                if (fill * area.height + (beforeBottom - top) < MIN_LAST_PAGE_FILL_IN_PAGE * area.height) continue;
                if (isHeadingOrIntro(previousOf(block))) continue;
                breaks.push(Number(block.dataset.block));
                break;
            }
        }
        return { total: flow.total, pageNumbers, hidden, breaksBefore: breaks };
    }, { MIN_LAST_PAGE_FILL_IN_PAGE: MIN_LAST_PAGE_FILL, MIN_EARLIER_PAGE_FILL_IN_PAGE: MIN_EARLIER_PAGE_FILL });
}

/**
 * Runs in the printed document, before it's laid out. Lays each table out at
 * the text's width, then remakes it as a block of rows, each a grid with the
 * column widths the table had, so that its pages break between whole rows.
 */
function setTablesAsRows(textWidth: string): void {
    document.body.style.width = textWidth;
    for (const table of document.querySelectorAll<HTMLTableElement>('section table')) {
        const rows = [...table.rows];
        if (rows.length === 0) continue;
        const width = table.getBoundingClientRect().width;
        const columns = [...rows[0].cells].map((cell) => `${(100 * cell.getBoundingClientRect().width) / width}%`).join(' ');
        const block = document.createElement('div');
        block.className = 'table';
        for (const row of rows) {
            const line = document.createElement('div');
            line.className = row.parentElement?.tagName === 'THEAD' ? 'table-row table-head' : 'table-row';
            line.style.gridTemplateColumns = columns;
            for (const cell of row.cells) {
                const box = document.createElement('div');
                box.className = 'table-cell';
                box.append(...cell.childNodes);
                line.append(box);
            }
            block.append(line);
        }
        table.replaceWith(block);
    }
    document.body.style.width = '';
}

function isSameNumbers(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/** Opens a page, waits for its diagrams, and returns its content. */
async function readPage(page: Page, url: string): Promise<string> {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(
        () => [...document.querySelectorAll('.mermaid')].every((diagram) => diagram.querySelector('svg') !== null),
        undefined,
        { timeout: DIAGRAM_WAIT_MS },
    );
    return page.evaluate(() => document.querySelector('.vp-doc')?.innerHTML ?? '');
}

/**
 * Runs in the printed document, before it's laid out. It leaves out what the
 * site has and a book doesn't: permalinks, copy buttons, a chapter's links to
 * related pages, and the parts of an example that run it. It gives each
 * chapter its opening, from its first heading. It gives each page's ids a
 * prefix, so pages can't clash, and turns each link to a page of the book
 * into a link within the document, which gives the page it goes to when
 * that's in another chapter, as do the contents. A link out of the book gets
 * a footnote with its address, numbered from 1 in each chapter. Last, it sets
 * the text as print does, outside code: curly quotes, en dashes and
 * ellipses.
 *
 * Every number is text before the layout, so nothing grows once the pages
 * are laid out. A page not yet known is written as 00, to be filled in by
 * the next layout.
 */
function prepareBook(options: PrepareOptions): void {
    const { docsPath, siteOrigin, pageIds, pageNumbers, breaksBefore } = options;
    for (const link of document.querySelectorAll<HTMLAnchorElement>('.contents a[href^="#"]')) {
        const id = link.hash.slice(1);
        const number = document.createElement('span');
        number.className = 'contents-page';
        number.dataset.target = id;
        number.textContent = pageNumbers[id] ?? '00';
        link.append(number);
    }
    // .online-only marks text that is about the site, such as the Preface's link to this PDF
    for (const element of document.querySelectorAll('.header-anchor, button.copy, span.lang, .try-it-box, .try-it-online, .try-it-caption > a, .online-only')) element.remove();
    for (const block of document.querySelectorAll('div[class*="language-"]')) block.classList.add('code');
    // Each line of code is a block of its own, since Paged.js drops the line
    // breaks between lines when it carries a block on to the next page
    for (const code of document.querySelectorAll('pre code')) {
        for (const node of [...code.childNodes]) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '') node.remove();
        }
    }
    for (const details of document.querySelectorAll('details')) details.open = true;
    // A chapter's links to related pages are for moving around the site
    for (const strong of document.querySelectorAll('section.chapter p > strong:first-child')) {
        if (strong.textContent === 'Related:') strong.parentElement?.remove();
    }

    for (const section of document.querySelectorAll<HTMLElement>('section.chapter')) {
        const heading = section.querySelector('h1');
        if (heading !== null) {
            const head = document.createElement('header');
            head.className = 'chapter-head';
            const label = section.dataset.label ?? '';
            if (label !== '') {
                const labelElement = document.createElement('p');
                labelElement.className = 'chapter-label';
                labelElement.textContent = label;
                head.append(labelElement);
            }
            const title = document.createElement('h1');
            title.textContent = section.dataset.title ?? heading.textContent;
            title.id = heading.id;
            head.append(title);
            heading.replaceWith(head);
        }

        const prefix = section.id;
        let notes = 0;
        // A diagram's own ids are left alone: its styles name them
        for (const element of section.querySelectorAll('[id]')) {
            if (element.closest('svg') === null) element.id = `${prefix}--${element.id}`;
        }
        const pageUrl = section.dataset.url ?? location.href;
        for (const link of section.querySelectorAll<HTMLAnchorElement>('a[href]')) {
            const url = new URL(link.getAttribute('href') ?? '', pageUrl);
            const isInSite = url.origin === location.origin;
            const path = isInSite && url.pathname.startsWith(docsPath)
                ? url.pathname.slice(docsPath.length).replace(/\.html$/, '').replace(/^$/, 'index')
                : undefined;
            const id = path === undefined ? undefined : pageIds[path];
            if (id !== undefined) {
                link.href = url.hash === '' ? `#${id}` : `#${id}--${decodeURIComponent(url.hash.slice(1))}`;
                const isElsewhere = id !== prefix && link.closest('h1, h2, h3, h4, pre, .chapter-head') === null;
                if (isElsewhere) {
                    const target = link.hash.slice(1);
                    const number = document.createElement('span');
                    number.className = 'page-ref';
                    number.dataset.target = target;
                    // In brackets already, the page joins them: "(Chapter 3, p. 19)"
                    const isInBrackets = link.nextSibling?.textContent?.startsWith(')') === true;
                    const page = pageNumbers[target] ?? '00';
                    number.textContent = isInBrackets ? `, p.\u00a0${page}` : ` (p.\u00a0${page})`;
                    link.append(number);
                }
                continue;
            }
            const address = isInSite ? siteOrigin + url.pathname + url.hash : url.href;
            link.href = address;
            // A link that shows its own address needs no footnote
            if (link.textContent.trim() === address || link.closest('pre') !== null) continue;
            notes++;
            const call = document.createElement('sup');
            call.className = 'note-call';
            call.textContent = String(notes);
            const note = document.createElement('span');
            note.className = 'footnote';
            const noteNumber = document.createElement('span');
            noteNumber.className = 'note-number';
            noteNumber.textContent = `${notes}.`;
            note.append(noteNumber, ` ${address}`);
            link.after(call, note);
        }
    }

    // Each block of each chapter is numbered, in reading order, so a layout
    // can name one to start a page before in the next
    const blocks = document.querySelectorAll<HTMLElement>('section.chapter > div > *, section.chapter > div > ul > li, section.chapter > div > ol > li');
    blocks.forEach((block, i) => {
        block.dataset.block = String(i);
        if (breaksBefore.includes(i)) block.dataset.breakBefore = 'page';
    });

    // The site's text is typed with straight quotes and hyphens. Each text
    // node is read with the character before it, which may be in the node
    // before, so a quote after a link or a code span still faces the right way.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let before = ' ';
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        if (text === '') continue;
        const isCode = node.parentElement?.closest('code, pre, svg, .footnote, style, script') !== null;
        if (!isCode) {
            let set = '';
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                // After a space, a bracket or a dash, a quote opens
                const opens = /[\s([{\u2013\u2014/]/.test(i === 0 ? before : text[i - 1]);
                if (char === '"') set += opens ? '\u201c' : '\u201d';
                else if (char === "'") set += opens && /[A-Za-z]/.test(text[i + 1] ?? '') ? '\u2018' : '\u2019';
                else set += char;
            }
            node.textContent = set
                // A spaced hyphen is a dash, and so is one between two numbers,
                // as in 4-10, but not one in a date, such as 2026-10-30
                .replace(/ - /g, ' \u2013 ')
                .replace(/(^|[^\d-])(\d+)-(\d+)(?![\d-])/g, '$1$2\u2013$3')
                .replace(/\.\.\./g, '\u2026');
        }
        before = text.at(-1) ?? before;
    }
}

/** Returns the contents: the preface, each part and the pages in it, and the conclusion, each with the page it starts on. */
function toContents(book: ReturnType<typeof listPrintedBook>): string {
    const items: string[] = [];
    for (const group of book) {
        const entries = group.pages.map(toEntry);
        if (entries.every((entry) => entry.number === undefined)) {
            for (const entry of entries) items.push(`<li class="contents-chapter contents-alone">${toContentsLink(`#${toPageId(entry.page)}`, undefined, entry.title)}</li>`);
            continue;
        }
        const part = toPart(group.text);
        const partTitle = part.label === undefined ? part.title : `${part.label}: ${part.title}`;
        const chapters = entries.map((entry) => `<li class="contents-chapter">${toContentsLink(`#${toPageId(entry.page)}`, entry.number, entry.title)}</li>`);
        items.push(`<li class="contents-part">${toContentsLink(`#${toPartId(group.text)}`, undefined, partTitle)}<ol>${chapters.join('')}</ol></li>`);
    }
    return `<nav class="front-matter contents"><h1>Contents</h1><ol>${items.join('')}</ol></nav>`;
}

function toContentsLink(href: string, number: string | undefined, title: string): string {
    const numberHtml = number === undefined ? '' : `<span class="contents-number">${escapeHtml(number)}</span>`;
    return `<a href="${href}">${numberHtml}<span class="contents-title">${escapeHtml(title)}</span><span class="contents-leader"></span></a>`;
}

/** The back of the title page: where the book comes from, and how it was set. */
function toColophon(): string {
    const online = SITE_ORIGIN === '' ? 'online' : `online, at ${escapeHtml(`${SITE_ORIGIN}${SITE_ROOT}docs/`)}`;
    const date = new Date().toISOString().slice(0, 10);
    return [
        `<p><em>${TITLE}</em> is also published ${online}, where its examples run in the page and can be changed as you read.</p>`,
        `<p>This copy was printed from the online edition on ${date}.</p>`,
        '<p>Set in Source Serif 4, Source Sans 3 and Source Code Pro.</p>',
    ].join('');
}

/** The @font-face rules for the book's fonts, served from their packages. */
function toFontFaces(): string {
    return FONTS.map(({ family, file, style }) => `@font-face {
    font-family: '${family}';
    font-style: ${style};
    font-display: block;
    font-weight: 200 900;
    src: url('${PRINT_PATH}@fontsource-variable/${file}') format('woff2-variations');
}`).join('\n');
}

/** Returns a page's address on the local server. */
function toPageUrl(path: string): string {
    return path === 'index' ? docsUrl : `${docsUrl}${path}.html`;
}

/** Returns the id a page's section has in the printed document. */
function toPageId(path: string): string {
    return `page-${path.replace(/[^a-z0-9]+/g, '-')}`;
}

function toPartId(text: string): string {
    return `part-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function withSlash(path: string): string {
    return path.endsWith('/') ? path : `${path}/`;
}
