import type { SiteConfig } from '@mvtjs/site-kit/arcade';
import { CATALOGUE } from './entries';

/** The arcade site: what its page shows, and the entries it lists. */
export const SITE: SiteConfig = {
    id: 'arcade',
    name: 'MVT Arcade',
    label: 'Arcade',
    wordmark: 'ARCADE',
    about: 'Arcade games, each built with Model-View-Ticker (MVT), an architecture for games and interactive apps. Pick one to play it, or open its info panel to learn more.',
    catalogue: CATALOGUE,
    entryKind: 'game',
};
