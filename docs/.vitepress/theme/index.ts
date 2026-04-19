import { h, defineComponent } from 'vue';
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
                'nav-bar-content-before': () => h('div', { class: 'site-cross-nav vp-raw' }, [
                    h('a', { href: __SITE_ROOT__ + 'games/', class: 'site-cross-link' }, 'Games'),
                    h('a', { href: __SITE_ROOT__ + 'docs/', class: 'site-cross-link active' }, 'Docs'),
                    h('a', { href: __SITE_ROOT__ + 'playground/', class: 'site-cross-link' }, 'Playground'),
                ]),
            });
        },
    }),
    enhanceApp({ app }) {
        app.component('PlaygroundLink', PlaygroundLink);
    },
} satisfies Theme;
