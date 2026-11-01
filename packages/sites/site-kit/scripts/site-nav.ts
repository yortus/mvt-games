/**
 * The site's nav, as HTML, for each site's page. A site's page marks where it
 * goes with `<!-- site-nav -->`, and the site's Vite config writes it there
 * (see `define-site-config.ts`), with the site's own link marked active. The
 * docs and the playground keep copies of their own, which a change here goes
 * to too: the docs' `.vitepress/theme/index.ts`, and the playground's
 * `index.html`.
 */

import type { SiteKind } from '@mvtjs/site-kit/arcade';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** The nav, with `site`'s link active, its links absolute from `siteRoot`, the root all the sites share. */
export function siteNavHtml(site: SiteKind, siteRoot: string): string {
    const links = LINKS.map((link) => {
        const isActive = link.site === site;
        const href = link.href.startsWith('https:') ? link.href : siteRoot + link.href;
        const external = link.href.startsWith('https:') ? ' target="_blank" rel="noopener"' : '';
        return `
                <li><a${isActive ? ' class="active"' : ''} href="${href}"${external}>
                    ${link.icon}
                    <span>${link.label}</span>
                </a></li>`;
    }).join('');
    return `<nav class="site-nav">
            <button class="site-nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
                <svg viewBox="0 0 20 20"><path d="M2 4.5h16M2 10h16M2 15.5h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
            </button>
            <!-- Absolute, since the same page is also each entry's, one folder down -->
            <a class="site-nav-brand" href="${siteRoot}${site}/">MVT Games</a>
            <ul class="site-nav-links">${links}
            </ul>
            <div class="site-nav-spacer"></div>
            <!-- The page's own tools, which its views fill: the search, the sound, the Perfmon and the (i) -->
            <div class="site-nav-tools" id="site-nav-tools"></div>
        </nav>
        <script>document.querySelector('.site-nav-toggle')?.addEventListener('click',function(){var n=this.closest('.site-nav');n.classList.toggle('site-nav--open');this.setAttribute('aria-expanded',n.classList.contains('site-nav--open'))});</script>`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface NavLink {
    readonly label: string;
    /** From the sites' root, or a full address for a link off the site. */
    readonly href: string;
    readonly icon: string;
    /** The site it is the link to, if it is one. */
    readonly site?: SiteKind;
}

const LINKS: readonly NavLink[] = [
    {
        label: 'Arcade',
        href: 'arcade/',
        site: 'arcade',
        icon: '<svg class="site-nav-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 5h8a5 5 0 015 5v1.5a2.5 2.5 0 01-4.6 1.4L13 11H7l-1.4 1.9A2.5 2.5 0 011 11.5V10a5 5 0 015-5z"/><path d="M6 7.5v4M4 9.5h4"/><circle cx="13" cy="8.5" r=".6"/><circle cx="15" cy="10.5" r=".6"/></svg>',
    },
    {
        label: 'Demos',
        href: 'demos/',
        site: 'demos',
        // A sparkle
        icon: '<svg class="site-nav-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l1.7 5.8 5.8 1.7-5.8 1.7L10 17.5l-1.7-5.8L2.5 10l5.8-1.7z"/></svg>',
    },
    {
        label: 'Puzzles',
        href: 'puzzles/',
        site: 'puzzles',
        // A grid of three by three
        icon: '<svg class="site-nav-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3h14v14H3zM7.7 3v14M12.3 3v14M3 7.7h14M3 12.3h14"/></svg>',
    },
    {
        label: 'Docs',
        href: 'docs/',
        icon: '<svg class="site-nav-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5.5C8.5 4.3 6 4 2.5 4.5V15c3.5-.5 6 0 7.5 1.2 1.5-1.2 4-1.7 7.5-1.2V4.5C14 4 11.5 4.3 10 5.5zM10 5.5v10.7"/></svg>',
    },
    {
        label: 'Playground',
        href: 'playground/',
        icon: '<svg class="site-nav-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17.5V4M7 17.5V4M3 7.5h4M3 11h4M3 14.5h4"/><path d="M7 4c3.5 0 4.5 2.5 6 6.5s2.5 6 5.5 6"/></svg>',
    },
    {
        label: 'GitHub',
        href: 'https://github.com/yortus/mvt-games',
        icon: '<svg class="site-nav-icon is-filled" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    },
];
