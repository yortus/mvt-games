import { h, defineComponent, type VNode } from 'vue';
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import PlaygroundLink from '../components/PlaygroundLink.vue';
import './custom.css';

declare const __SITE_ROOT__: string;

export default {
    extends: DefaultTheme,
    Layout: defineComponent({
        name: 'CustomLayout',
        setup() {
            return () => h(DefaultTheme.Layout, null, {
                // The site's links, as the Arcade's and the playground's navs have them: in the bar, and in
                // VitePress's own menu on a narrow screen, where they fold away from the bar
                'nav-bar-content-before': () => h('div', { class: 'site-cross-nav vp-raw' }, crossLinks()),
                'nav-screen-content-before': () => h('div', { class: 'site-cross-nav site-cross-nav-screen vp-raw' }, crossLinks()),
            });
        },
    }),
    enhanceApp({ app }) {
        app.component('PlaygroundLink', PlaygroundLink);
    },
} satisfies Theme;

// ---------------------------------------------------------------------------
// The site's links
// ---------------------------------------------------------------------------

/** One of the site's links: its label, its address, and its icon, drawn as the other sites' navs draw it. */
interface CrossLink {
    readonly label: string;
    readonly href: string;
    readonly isActive?: boolean;
    readonly isExternal?: boolean;
    /** The icon's SVG, without its outer element. */
    readonly icon: string;
    readonly viewBox: string;
    /** Whether the icon is a filled shape, as the GitHub mark is, rather than strokes. */
    readonly isFilled?: boolean;
}

/**
 * The site's links: plain `<a>` elements, which VitePress's router leaves
 * alone (`vp-raw`), since the Arcade and the playground are not pages of the
 * docs.
 */
const CROSS_LINKS: readonly CrossLink[] = [
    {
        label: 'Arcade',
        href: `${__SITE_ROOT__}arcade/`,
        viewBox: '0 0 20 20',
        icon: '<path d="M6 5h8a5 5 0 015 5v1.5a2.5 2.5 0 01-4.6 1.4L13 11H7l-1.4 1.9A2.5 2.5 0 011 11.5V10a5 5 0 015-5z"/><path d="M6 7.5v4M4 9.5h4"/><circle cx="13" cy="8.5" r=".6"/><circle cx="15" cy="10.5" r=".6"/>',
    },
    {
        label: 'Docs',
        href: `${__SITE_ROOT__}docs/`,
        isActive: true,
        viewBox: '0 0 20 20',
        icon: '<path d="M10 5.5C8.5 4.3 6 4 2.5 4.5V15c3.5-.5 6 0 7.5 1.2 1.5-1.2 4-1.7 7.5-1.2V4.5C14 4 11.5 4.3 10 5.5zM10 5.5v10.7"/>',
    },
    {
        label: 'Playground',
        href: `${__SITE_ROOT__}playground/`,
        viewBox: '0 0 20 20',
        icon: '<path d="M3 17.5V4M7 17.5V4M3 7.5h4M3 11h4M3 14.5h4"/><path d="M7 4c3.5 0 4.5 2.5 6 6.5s2.5 6 5.5 6"/>',
    },
    {
        label: 'GitHub',
        href: 'https://github.com/yortus/mvt-games',
        isExternal: true,
        viewBox: '0 0 16 16',
        isFilled: true,
        icon: '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>',
    },
];

function crossLinks(): VNode[] {
    return CROSS_LINKS.map((link) => h('a', {
        href: link.href,
        class: link.isActive === true ? 'site-cross-link active' : 'site-cross-link',
        ...(link.isExternal === true ? { target: '_blank', rel: 'noopener' } : {}),
    }, [
        h('svg', {
            'class': link.isFilled === true ? 'site-cross-icon is-filled' : 'site-cross-icon',
            'viewBox': link.viewBox,
            'aria-hidden': 'true',
            'innerHTML': link.icon,
        }),
        h('span', link.label),
    ]));
}
