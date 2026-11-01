/**
 * Vite plugin giving each entry an address of its own, inside its site's:
 * `<root>arcade/crumb-chase/`. A link to it, shared, previews as the entry,
 * since sites that build previews read the page's `<meta>` tags. So each
 * entry needs a page of its own, with its own tags.
 *
 * The build writes one for each catalogue entry: a copy of the site's built
 * page, with the entry's name and summary in its title and its Open Graph
 * tags (`og:title`, `og:description`), and its share image, a picture of it
 * as it plays, in `og:image` (see `share-image.ts`). The copy is the site's
 * page, which plays the entry its address names. The site's own page shows
 * the site's share image, a picture of its card wall.
 *
 * An entry that moved to another site keeps its old address: the build writes
 * a page there that sends the visitor on to the new one. And the site that is
 * the root writes the root's two pages, beside its own folder: `index.html`,
 * which sends the visitor on to it, and `404.html`, which static hosts such
 * as GitHub Pages serve for any address they have no file for. It sends the
 * visitor to the wall of the site the address is in.
 *
 * The dev server has no copies. It serves the site's page for an address
 * that names an entry, and sends a moved entry's address on.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';
import { type Plugin, runnerImport } from 'vite';
import type { SiteKind } from '@mvtjs/site-kit/arcade';
import { ENTRIES_DIR, findEntryDirectories } from './entry-facts.ts';
import {
    findShareImage,
    SHARE_IMAGE_HEIGHT,
    SHARE_IMAGE_WIDTH,
    SITE_SHARE_IMAGE,
    siteShareImageAlt,
} from './share-image.ts';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EntryPagesPluginOptions {
    /** The site, whose folder in the sites' root its Vite base ends with. */
    readonly site: SiteKind;
    /** The root all the sites share, as built: `/` or `/mvt-games/`. */
    readonly siteRoot: string;
    /** Entries that once lived in this site and moved to another, by id, with the site each moved to. */
    readonly movedEntries?: Readonly<Record<string, SiteKind>>;
    /** Whether this site's build writes the root's `index.html` and `404.html`, which send visitors on to it. */
    readonly isSiteRoot?: boolean;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function entryPagesPlugin(options: EntryPagesPluginOptions): Plugin {
    const { site, siteRoot, movedEntries = {}, isSiteRoot = false } = options;
    let srcDir = '';
    let outDir = '';
    let base = '/';

    return {
        name: 'entry-pages',
        configResolved(config) {
            base = config.base;
            srcDir = join(config.root, 'src');
            outDir = resolve(config.root, config.build.outDir);
        },
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = new URL(req.url ?? '/', 'http://localhost');
                // `<root>demos` and `<root>demos/boids` gain their slash, as on Pages
                const path = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
                const id = path.startsWith(base) ? path.slice(base.length, -1) : undefined;
                const isSite = id === '';
                const isEntry = id !== undefined && !id.includes('/') && id in findEntryDirectories(srcDir);
                const movedTo = id === undefined ? undefined : movedEntries[id];
                if (movedTo !== undefined) {
                    res.writeHead(302, { Location: `${siteRoot}${movedTo}/${id}/${url.search}` });
                    res.end();
                    return;
                }
                if ((isSite || isEntry) && path !== url.pathname) {
                    res.writeHead(302, { Location: path + url.search });
                    res.end();
                    return;
                }
                if (isEntry) req.url = base + 'index.html' + url.search;
                next();
            });
        },
        generateBundle: {
            // After Vite's own, which adds the built pages to the bundle
            order: 'post',
            async handler(_options, bundle) {
                const page = bundle['index.html'];
                if (page?.type !== 'asset' || typeof page.source !== 'string') {
                    this.error('found no index.html, the site\'s page, in the build');
                }
                const siteHtml = page.source;
                const siteTitle = readTitle(siteHtml);
                // The site's origin, such as `https://example.com`, which Open Graph's addresses need.
                // A build with none, for trying the site out, writes them from the site's root
                const origin = process.env.SITE_ORIGIN ?? '';
                const siteUrl = origin + base;

                // The site's share image, a picture of its card wall
                this.emitFile({
                    type: 'asset',
                    fileName: SITE_SHARE_IMAGE,
                    source: readShareImage(join(srcDir, basename(SITE_SHARE_IMAGE)), site),
                });
                const siteImageTags = imageTags(origin + base + SITE_SHARE_IMAGE, siteShareImageAlt(siteTitle));
                page.source = addTags(siteHtml, [['og:url', siteUrl], ...siteImageTags]);

                const { module } = await runnerImport<{ CATALOGUE: readonly CatalogueEntry[] }>(
                    join(srcDir, ENTRIES_DIR, 'catalogue.ts'),
                    { configFile: false, root: join(srcDir, '..'), logLevel: 'error' },
                );
                const entryDirs = findEntryDirectories(srcDir);
                for (const entry of module.CATALOGUE) {
                    const folder = `${entry.id}/`;
                    const clash = Object.keys(bundle).find((name) => name.startsWith(folder));
                    if (clash !== undefined) this.error(`${entry.id}: its page would be at ${folder}, but the build writes ${clash} there`);
                    const imageFile = findShareImage(join(entryDirs[entry.id] ?? '', 'start')) ?? join(entryDirs[entry.id] ?? '', 'start', 'share.png');
                    const image = this.getFileName(this.emitFile({
                        type: 'asset',
                        name: `${entry.id}-${basename(imageFile)}`,
                        source: readShareImage(imageFile, entry.id),
                    }));

                    // As the site's page writes the title while the entry plays
                    const title = `${entry.name} - ${siteTitle}`;
                    let html = replaceOnce(siteHtml, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
                    html = replaceContent(html, 'name="description"', entry.summary);
                    html = replaceContent(html, 'property="og:title"', entry.name);
                    html = replaceContent(html, 'property="og:description"', entry.summary);
                    html = addTags(html, [
                        ['og:url', siteUrl + entry.id + '/'],
                        ...imageTags(origin + base + image, `A screen from ${entry.name}, in the ${siteTitle}`),
                    ]);
                    this.emitFile({ type: 'asset', fileName: folder + 'index.html', source: html });
                }

                // A moved entry's old address sends the visitor on to its new one. The
                // page has no preview of its own: its new page has that
                for (const [id, movedTo] of Object.entries(movedEntries)) {
                    const to = `${siteRoot}${movedTo}/${id}/`;
                    this.emitFile({ type: 'asset', fileName: `${id}/index.html`, source: redirectPage(`'${to}' + location.search`, to, [], NOINDEX) });
                }
            },
        },
        // The root's pages are beside the site's folder, outside the bundle, so they are written once it is
        writeBundle() {
            if (!isSiteRoot) return;
            const rootDir = resolve(outDir, '..');
            const origin = process.env.SITE_ORIGIN ?? '';
            const siteUrl = `${origin}${siteRoot}${site}/`;
            // A link from before the sites had folders of their own named an
            // entry in the fragment (`#crumb-chase`), and goes to that entry's
            // address in this site, which sends a moved entry on. Only a script
            // can read the fragment
            const toSite = `'${siteRoot}${site}/' + (/^[a-z0-9-]+$/.test(location.hash.slice(1)) ? location.hash.slice(1) + '/' : '') + location.search`;
            // A link to the root, shared, previews as the site it sends visitors to
            const shareTags: Tag[] = [
                ['og:type', 'website'],
                ['og:site_name', ROOT_TITLE],
                ['og:title', ROOT_TITLE],
                ['og:description', ROOT_DESCRIPTION],
                ['og:url', siteUrl],
                ...imageTags(siteUrl + SITE_SHARE_IMAGE, siteShareImageAlt(ROOT_TITLE)),
            ];
            const more = `<meta name="description" content="${ROOT_DESCRIPTION}" />\n<meta name="twitter:card" content="summary_large_image" />`;
            writeFileSync(join(rootDir, 'index.html'), redirectPage(toSite, `${siteRoot}${site}/`, shareTags, more));
            // Any address with no file goes to the wall of the site whose folder it is in, or else this site's
            const toWall = `'${siteRoot}' + (function (s) { return ${JSON.stringify(SITES)}.indexOf(s) >= 0 ? s : '${site}'; })`
                + `(location.pathname.slice(${siteRoot.length}).split('/')[0]) + '/' + location.search`;
            writeFileSync(join(rootDir, '404.html'), redirectPage(toWall, `${siteRoot}${site}/`, [], NOINDEX));
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** What the plugin reads of each catalogue entry. */
interface CatalogueEntry {
    readonly id: string;
    readonly name: string;
    readonly summary: string;
}

/** An Open Graph tag: its property, and its content. */
type Tag = readonly [property: string, content: string];

/** The tags that show the share image at `url`. Every share image is the same size. */
function imageTags(url: string, alt: string): Tag[] {
    return [
        ['og:image', url],
        ['og:image:width', String(SHARE_IMAGE_WIDTH)],
        ['og:image:height', String(SHARE_IMAGE_HEIGHT)],
        ['og:image:alt', alt],
    ];
}

/** The share image at `file`, which `generate-thumbnails` makes for `id`, an entry or a site. */
function readShareImage(file: string, id: string): Uint8Array {
    try {
        return readFileSync(file);
    }
    catch {
        throw new Error(`entry pages: ${id} has no share image at ${file}. Make one with \`npm run generate-thumbnails -- ${id}\``);
    }
}

function readTitle(html: string): string {
    const match = /<title>([^<]*)<\/title>/.exec(html);
    if (match === null) throw new Error('entry pages: the site\'s page has no <title>');
    return match[1];
}

/** Adds Open Graph tags, and any other markup, at the end of the page's head. */
function addTags(html: string, tags: readonly Tag[], more = ''): string {
    const lines = tags.map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}" />`);
    if (more !== '') lines.push(more);
    return replaceOnce(html, /<\/head>/, `${lines.join('\n')}\n</head>`);
}

/** Replaces the `content` of the one `<meta>` tag with `attribute`, such as `name="description"`. */
function replaceContent(html: string, attribute: string, content: string): string {
    return replaceOnce(html, new RegExp(`<meta ${attribute} content="[^"]*"`), `<meta ${attribute} content="${escapeHtml(content)}"`);
}

/** Replaces the first match of `pattern`, which the page must have. The replacement is taken as it is, with no `$` patterns. */
function replaceOnce(html: string, pattern: RegExp, replacement: string): string {
    if (!pattern.test(html)) throw new Error(`entry pages: the site's page has nothing that matches ${pattern}`);
    return html.replace(pattern, () => replacement);
}

function escapeHtml(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** The sites, each a folder of the root. The 404 page sends an address in one to its wall. */
const SITES: readonly SiteKind[] = ['arcade', 'demos', 'puzzles'];

/** What the root's pages are called, and what the root says it is. */
const ROOT_TITLE = 'MVT Games';
const ROOT_DESCRIPTION = 'Games, demos and puzzles, each built with Model-View-Ticker, an architecture for games and interactive apps.';

/** Keeps a page that only sends visitors on out of search engines, and out of the link previews' check. */
const NOINDEX = '<meta name="robots" content="noindex" />';

/**
 * A page that sends the visitor on at once: to the address `script` works
 * out, or, without scripts, to `fallback`. It is dark from its first frame,
 * as the sites' pages are.
 */
function redirectPage(script: string, fallback: string, tags: readonly Tag[] = [], more = ''): string {
    const lines = [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="UTF-8" />',
        `<script>location.replace(${script});</script>`,
        `<noscript><meta http-equiv="refresh" content="0; url=${escapeHtml(fallback)}" /></noscript>`,
        `<title>${ROOT_TITLE}</title>`,
        ...tags.map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}" />`),
        ...(more === '' ? [] : [more]),
        '<style>html { background: #0d1117; color-scheme: dark; }</style>',
        '</head>',
        `<body><p><a href="${escapeHtml(fallback)}" style="color: #58a6ff">Go on to ${ROOT_TITLE}</a></p></body>`,
        '</html>',
    ];
    return lines.join('\n') + '\n';
}
