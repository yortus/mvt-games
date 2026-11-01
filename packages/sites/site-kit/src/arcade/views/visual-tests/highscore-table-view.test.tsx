import { htmlTest } from 'v-snap';
import '../../arcade.css';
import { type HighscoreRow, TABLE_SIZE } from '../../../highscores';
import { HighscoreTableView, type HighscoreTableViewBindings } from '../highscore-table-view';
import { wearTheme } from './wear-theme.test-support';

/** Initials for each place, so every row reads differently. */
const INITIALS = ['TJG', 'ACE', 'BOB', 'K.O', 'ZAP', 'MAX', 'R2D', 'JO ', 'Q.T', 'WIZ'];

/** A table of `count` rows, best first, from a top score that each place halves, more or less. */
function rowsOf(count: number): HighscoreRow[] {
    const rows: HighscoreRow[] = [];
    for (let i = 0; i < count; i++) rows.push({ initials: INITIALS[i], score: Math.round(98760 / (i + 1)), at: i });
    return rows;
}

/** Returns the table as the info panel's Highscores tab shows it, in a narrow panel, on its dark background. */
function inPanel(bindings: HighscoreTableViewBindings): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'info-highscores';
    // On the panel's surface, in whatever theme the page wears
    panel.style.cssText = 'width:276px;padding:12px;background:var(--theme-surface);';
    panel.append(HighscoreTableView(bindings));
    return panel;
}

htmlTest('a full table', () => {
    const rows = rowsOf(TABLE_SIZE);
    return inPanel({ rows: () => rows, status: () => 'ready' });
});

htmlTest('three places taken', () => {
    const rows = rowsOf(3);
    return inPanel({ rows: () => rows, status: () => 'ready' });
});

htmlTest('the row just entered, lit', () => {
    const rows = rowsOf(TABLE_SIZE);
    return inPanel({ rows: () => rows, status: () => 'ready', highlightRank: () => 4 });
});

htmlTest('a full table, in the Dark theme', () => {
    wearTheme('dark');
    const rows = rowsOf(TABLE_SIZE);
    return inPanel({ rows: () => rows, status: () => 'ready' });
});

htmlTest('a full table, in the Light theme', () => {
    wearTheme('light');
    const rows = rowsOf(TABLE_SIZE);
    return inPanel({ rows: () => rows, status: () => 'ready' });
});
