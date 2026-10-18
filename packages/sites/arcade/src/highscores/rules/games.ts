import type { GameRulesTable } from './submission';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The cap for a game whose score has no end: seven digits, more than a long evening's play. */
const OPEN_ENDED = 9_999_999;

/**
 * Every game with a highscore table, by game id. The caps are loose, set
 * from what each game can plausibly reach, and catch only the laziest cheat.
 * A change to a game's scoring that makes its old table unfair bumps its
 * version: the old rows stay stored, unread, and a fresh table starts.
 */
export const GAMES: GameRulesTable = {
    'astrovoid': { version: 1, maxScore: OPEN_ENDED },
    'burrow-bust': { version: 1, maxScore: OPEN_ENDED },
    // 252 crumbs at 10 each, all of them to win
    'crumb-chase': { version: 1, maxScore: 2520 },
    // The whole metres dived before the crash
    'deep-dive': { version: 1, maxScore: OPEN_ENDED },
    'fenceline': { version: 1, maxScore: OPEN_ENDED },
    'fuel-run': { version: 1, maxScore: OPEN_ENDED },
    'galaxy-raiders': { version: 1, maxScore: OPEN_ENDED },
    'garden-snake': { version: 1, maxScore: OPEN_ENDED },
    'kwazy-cactii': { version: 1, maxScore: OPEN_ENDED },
    // Two loops, chains up to x32: six or seven digits for a good run
    'neon-monsoon': { version: 1, maxScore: 99_999_999 },
};
