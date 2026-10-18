/**
 * Vite plugin giving each entry an address of its own, inside the Arcade's:
 * `<base>arcade/crumb-chase/`. A link to it, shared, previews as the entry,
 * since sites that build previews read the page's `<meta>` tags. So each
 * entry needs a page of its own, with its own tags.
 *
 * The build writes one for each catalogue entry: a copy of the Arcade's
 * built page, with the entry's name and summary in its title and its Open
 * Graph tags (`og:title`, `og:description`), and its share image, a picture
 * of it as it plays, in `og:image` (see `share-image.ts`). The copy is the
 * Arcade, which plays the entry its address names. The Arcade's own page, and
 * the site's root, show the Arcade's share image, a picture of its card wall.
 * The build also writes `404.html`, another copy, which static hosts such as
 * GitHub Pages serve for any address they have no file for. So an address
 * that names no entry lands on the Arcade's wall.
 *
 * The dev server has no copies. It serves the Arcade's page for an address
 * that names an entry.
 */

import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import process from 'node:process';
import { type Plugin, runnerImport } from 'vite';
import { ENTRIES_DIR, findEntryDirectories } from './entry-facts.ts';
import {
    findShareImage,
    SHARE_IMAGE_HEIGHT,
    SHARE_IMAGE_WIDTH,
    SITE_SHARE_IMAGE,
    SITE_SHARE_IMAGE_ALT,
} from './share-image.ts';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EntryPagesPluginOptions {
    /** The folder the Arcade's page is in, under the site's base, as built: `arcade` for `<base>arcade/index.html`. */
    readonly arcadeDir: string;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function entryPagesPlugin(options: EntryPagesPluginOptions): Plugin {
    const { arcadeDir } = options;
    const srcDir = join(import.meta.dirname, '..', 'src');
    const arcadePage = `${arcadeDir}/index.html`;
    let base = '/';

    return {
        name: 'entry-pages',
        configResolved(config) {
            base = config.base;
        },
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = new URL(req.url ?? '/', 'http://localhost');
                const arcadePath = base + arcadeDir + '/';
                // `<base>arcade` and `<base>arcade/crumb-chase` gain their slash, as on Pages
                const path = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
                const id = path.startsWith(arcadePath) ? path.slice(arcadePath.length, -1) : undefined;
                const isArcade = id === '';
                const isEntry = id !== undefined && !id.includes('/') && id in findEntryDirectories(srcDir);
                if ((isArcade || isEntry) && path !== url.pathname) {
                    res.writeHead(302, { Location: path + url.search });
                    res.end();
                    return;
                }
                if (isEntry) req.url = arcadePath + 'index.html' + url.search;
                next();
            });
        },
        generateBundle: {
            // After Vite's own, which adds the built pages to the bundle
            order: 'post',
            async handler(_options, bundle) {
                const page = bundle[arcadePage];
                if (page?.type !== 'asset' || typeof page.source !== 'string') {
                    this.error(`found no ${arcadePage} in the build`);
                }
                const root = bundle['index.html'];
                if (root?.type !== 'asset' || typeof root.source !== 'string') {
                    this.error('found no index.html, the site\'s root, in the build');
                }
                const arcadeHtml = page.source;
                const arcadeTitle = readTitle(arcadeHtml);
                // The site's origin, such as `https://example.com`, which Open Graph's addresses need.
                // A build with none, for trying the site out, writes them from the site's root
                const origin = process.env.SITE_ORIGIN ?? '';
                const arcadeUrl = origin + base + arcadeDir + '/';

                // The Arcade's share image, at the address the docs and the playground name too
                this.emitFile({
                    type: 'asset',
                    fileName: SITE_SHARE_IMAGE,
                    source: readShareImage(join(srcDir, 'arcade', basename(SITE_SHARE_IMAGE)), 'arcade'),
                });
                const siteImageTags = imageTags(origin + base + SITE_SHARE_IMAGE, SITE_SHARE_IMAGE_ALT);

                page.source = addTags(arcadeHtml, [['og:url', arcadeUrl], ...siteImageTags]);
                // The root sends the visitor on to the Arcade, so a link to it is one to the Arcade
                root.source = addTags(root.source, [['og:url', arcadeUrl], ...siteImageTags]);
                this.emitFile({
                    type: 'asset',
                    fileName: '404.html',
                    source: addTags(arcadeHtml, siteImageTags, '<meta name="robots" content="noindex" />'),
                });

                const { module } = await runnerImport<{ CATALOGUE: readonly CatalogueEntry[] }>(
                    join(srcDir, ENTRIES_DIR, 'catalogue.ts'),
                    { configFile: false, root: join(srcDir, '..'), logLevel: 'error' },
                );
                const entryDirs = findEntryDirectories(srcDir);
                for (const entry of module.CATALOGUE) {
                    const folder = `${arcadeDir}/${entry.id}/`;
                    const clash = Object.keys(bundle).find((name) => name.startsWith(folder));
                    if (clash !== undefined) this.error(`${entry.id}: its page would be at ${folder}, but the build writes ${clash} there`);
                    const imageFile = findShareImage(join(entryDirs[entry.id] ?? '', 'start')) ?? join(entryDirs[entry.id] ?? '', 'start', 'share.png');
                    const image = this.getFileName(this.emitFile({
                        type: 'asset',
                        name: `${entry.id}-${basename(imageFile)}`,
                        source: readShareImage(imageFile, entry.id),
                    }));

                    // As the Arcade's page writes the title while the entry plays
                    const title = `${entry.name} - ${arcadeTitle}`;
                    let html = replaceOnce(arcadeHtml, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
                    html = replaceContent(html, 'name="description"', entry.summary);
                    html = replaceContent(html, 'property="og:title"', entry.name);
                    html = replaceContent(html, 'property="og:description"', entry.summary);
                    html = addTags(html, [
                        ['og:url', arcadeUrl + entry.id + '/'],
                        ...imageTags(origin + base + image, `A screen from ${entry.name}, a ${entry.tags.kind} in the ${arcadeTitle}`),
                    ]);
                    this.emitFile({ type: 'asset', fileName: folder + 'index.html', source: html });
                }
            },
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
    readonly tags: { readonly kind: string };
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

/** The share image at `file`, which `generate-thumbnails` makes for `id`, an entry or `arcade`. */
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
    if (match === null) throw new Error('entry pages: the Arcade\'s page has no <title>');
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
    if (!pattern.test(html)) throw new Error(`entry pages: the Arcade's page has nothing that matches ${pattern}`);
    return html.replace(pattern, () => replacement);
}

function escapeHtml(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
