import type { SiteConfig } from '@mvtjs/site-kit/arcade';
import { CATALOGUE } from './entries';

/** The puzzles site: what its page shows, and the entries it lists. */
export const SITE: SiteConfig = {
    id: 'puzzles',
    name: 'MVT Puzzles',
    label: 'Puzzles',
    wordmark: 'PUZZLES',
    about: 'Puzzles to sit with, each built with Model-View-Ticker (MVT), an architecture for games and interactive apps. Pick one to play it, or open its info panel to learn more.',
    catalogue: CATALOGUE,
    entryKind: 'game',
};
