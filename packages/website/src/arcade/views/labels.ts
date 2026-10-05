import type { EntryFacts } from '../../entries';
import type { TagChip, TagGroup } from '../models';

// The words the arcade shows for its tags and their groups, and for the
// facts measured from each entry's source.

/** A group of tags, as its heading reads. */
export const GROUP_LABELS: Readonly<Record<TagGroup, string>> = {
    kind: 'Type',
    era: 'Era',
    genre: 'Genre',
    renderer: 'Renderer',
};

/** A tag, as a chip or a card reads it. Values not listed read as they are, capitalised. */
export function tagLabel(chip: TagChip): string {
    return VALUE_LABELS[chip.value] ?? chip.value.charAt(0).toUpperCase() + chip.value.slice(1);
}

/** An entry's size, as its info panel reads it: "1.3k lines, 20 files". */
export function sizeLabel(facts: EntryFacts): string {
    const lines = facts.lines < 1000 ? String(facts.lines) : `${(facts.lines / 1000).toFixed(1)}k`;
    return `${lines} lines, ${facts.files} ${facts.files === 1 ? 'file' : 'files'}`;
}

/** The repo's address on GitHub, for links to an entry's source. */
export const SOURCE_ROOT = 'https://github.com/yortus/mvt-games/tree/main/';

const VALUE_LABELS: Readonly<Record<string, string>> = {
    '3d': '3D',
    'ui': 'UI',
    'pixi': 'Pixi',
    'three': 'three.js',
    'html': 'HTML',
};
