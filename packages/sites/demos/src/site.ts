import type { SiteConfig } from '@mvtjs/site-kit/arcade';
import { CATALOGUE } from './entries';

/** The demos site: what its page shows, and the entries it lists. */
export const SITE: SiteConfig = {
    id: 'demos',
    name: 'MVT Demos',
    label: 'Demos',
    wordmark: 'DEMOS',
    about: 'Demos and art, each built with Model-View-Ticker (MVT), an architecture for games and interactive apps: simulations, techniques, and pieces to watch. Pick one to run it, or open its info panel to learn how it is made.',
    catalogue: CATALOGUE,
    entryKind: 'demo',
};
