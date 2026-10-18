/**
 * Vite plugin giving each entry an address of its own, inside the Arcade's:
 * `<base>arcade/crumb-chase/`. A link to it, shared, previews as the entry,
 * since sites that build previews read the page's `<meta>` tags. So each
 * entry needs a page of its own, with its own tags.
 *
 * The build writes one for each catalogue entry: a copy of the Arcade's
 * built page, with the entry's name, summary and thumbnail in its title and
 * its Open Graph tags (`og:title`, `og:description`, `og:image`). The copy is
 * the Arcade, which plays the entry its address names. The build also writes
 * `404.html`, another copy, which static hosts such as GitHub Pages serve for
 * any address they have no file for. So an address that names no entry
 * lands on the Arcade's wall.
 *
 * The dev server has no copies. It serves the Arcade's page for an address
 * that names an entry.
 */

import { join } from 'node:path';
import process from 'node:process';
import { type Plugin, type Rolldown, runnerImport } from 'vite';
import { ENTRIES_DIR, findEntryDirectories } from './entry-facts.ts';

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
                const arcadeHtml = page.source;
                const arcadeTitle = readTitle(arcadeHtml);
                // The site's origin, such as `https://example.com`, which Open Graph's addresses need.
                // A build with none, for trying the site out, writes them from the site's root
                const origin = process.env.SITE_ORIGIN ?? '';
                const arcadeUrl = origin + base + arcadeDir + '/';

                page.source = addTags(arcadeHtml, [['og:url', arcadeUrl]]);
                this.emitFile({
                    type: 'asset',
                    fileName: '404.html',
                    source: addTags(arcadeHtml, [], '<meta name="robots" content="noindex" />'),
                });

                const { module } = await runnerImport<{ CATALOGUE: readonly CatalogueEntry[] }>(
                    join(srcDir, ENTRIES_DIR, 'catalogue.ts'),
                    { configFile: false, root: join(srcDir, '..'), logLevel: 'error' },
                );
                for (const entry of module.CATALOGUE) {
                    const folder = `${arcadeDir}/${entry.id}/`;
                    const clash = Object.keys(bundle).find((name) => name.startsWith(folder));
                    if (clash !== undefined) this.error(`${entry.id}: its page would be at ${folder}, but the build writes ${clash} there`);
                    const thumbnail = findThumbnail(bundle, entry.thumbnail);
                    if (thumbnail === undefined) this.error(`${entry.id}: found no file for its thumbnail, ${entry.thumbnail}, in the build`);

                    // As the Arcade's page writes the title while the entry plays
                    const title = `${entry.name} - ${arcadeTitle}`;
                    let html = replaceOnce(arcadeHtml, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
                    html = replaceContent(html, 'name="description"', entry.summary);
                    html = replaceContent(html, 'property="og:title"', entry.name);
                    html = replaceContent(html, 'property="og:description"', entry.summary);
                    html = addTags(html, [
                        ['og:url', arcadeUrl + entry.id + '/'],
                        ['og:image', origin + base + thumbnail],
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
    /** Its thumbnail's address while the site is served from source: `/src/entries/<id>/start/thumbnail.webp`. */
    readonly thumbnail: string;
}

/** The built file for the thumbnail at `sourceUrl`, from the site's base: `assets/thumbnail-1a2b3c.webp`. */
function findThumbnail(bundle: Rolldown.OutputBundle, sourceUrl: string): string | undefined {
    const wanted = sourceUrl.replace(/^\//, '');
    for (const file of Object.values(bundle)) {
        if (file.type !== 'asset') continue;
        if (file.originalFileNames.some((name) => name.replaceAll('\\', '/').endsWith(wanted))) return file.fileName;
    }
    return undefined;
}

function readTitle(html: string): string {
    const match = /<title>([^<]*)<\/title>/.exec(html);
    if (match === null) throw new Error('entry pages: the Arcade\'s page has no <title>');
    return match[1];
}

/** Adds Open Graph tags, and any other markup, at the end of the page's head. */
function addTags(html: string, tags: readonly (readonly [property: string, content: string])[], more = ''): string {
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
