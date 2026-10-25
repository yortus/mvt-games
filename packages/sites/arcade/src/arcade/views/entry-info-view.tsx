/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';
import { memoiseLast } from '@mvtjs/utils';
import type { HighscoreRow } from '../../highscores';
import type { ArcadeEntry, EntryDetails, EntryFacts, Inspiration } from '../../entry-types';
import { type HighscoresStatus, TAG_GROUPS, tagValuesOf } from '../models';
import { focusOnOpen } from './focus-on-open';
import { HighscoreTableView } from './highscore-table-view';
import { HowToPlayView } from './how-to-play-view';
import { GROUP_LABELS, sizeLabel, SOURCE_ROOT, tagLabel } from './labels';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface EntryInfoViewBindings {
    /** The entry to tell about, or none, when the panel is closed. */
    readonly entry: () => ArcadeEntry | undefined;
    /** The entry's long text, once it has loaded. Until then, the panel tells what the card does. */
    readonly details: () => EntryDetails | undefined;
    readonly factsFor: (id: string) => EntryFacts | undefined;
    /** The table of the entry with `id`, best first, for an entry that keeps one. */
    readonly highscoreRowsFor: (id: string) => readonly HighscoreRow[];
    /** Whether the tables are here, on their way, or out of reach. */
    readonly highscoresStatus: () => HighscoresStatus;
    /**
     * Whether the panel is over the entry it tells about, which is paused
     * behind it. It then opens on how to play, and its button resumes the
     * entry rather than starting it.
     */
    readonly isOverEntry: () => boolean;
    readonly onClosePressed?: () => void;
    /** Reported as Play is pressed, or Resume, over the entry. */
    readonly onPlayPressed?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An entry's info panel, over the wall, or over the entry as it plays:
 * everything the card leaves out. Its name, its tags (the renderers it draws
 * with among them) and the classic it is inspired by head the panel. Then
 * come tabs, each where the entry has it: Description (what it is, how it's
 * made, the techniques it shows, and its size), How to Play, and Highscores. Play, or
 * Resume over the entry, and a link to its source end it.
 *
 * It opens on Description, or on How to Play over the entry, where that is
 * what the player is likely to want. Left and Right switch tabs from a
 * tab's button. Which tab shows is the view's own presentation state. The
 * page that shows sets the panel's height; its width and its top stay put
 * as the tabs change.
 */
export function EntryInfoView(bindings: EntryInfoViewBindings): Element {
    // Each is worked out once per entry shown, keyed by the entry's id
    const paragraphsOf = memoiseLast((description: string | undefined) => description?.split('\n\n') ?? NONE);
    const implementationParagraphsOf = memoiseLast((implementation: string | undefined) => implementation?.split('\n\n') ?? NONE);
    const tagsFor = memoiseLast((_id: string | undefined) => describeTags(bindings.entry(), bindings.factsFor));
    const sizeFor = memoiseLast((id: string | undefined) => describeSize(id === undefined ? undefined : bindings.factsFor(id)));
    const inspirationFor = memoiseLast((_id: string | undefined) => describeInspiration(bindings.entry()?.inspiredBy));
    const sourceFor = memoiseLast((id: string | undefined) => {
        const facts = id === undefined ? undefined : bindings.factsFor(id);
        return facts === undefined ? SOURCE_ROOT : SOURCE_ROOT + facts.sourcePath;
    });
    const techniques = (): readonly string[] => bindings.details()?.techniques ?? NONE;
    // Presentation state: the tab that shows, and the entry it was chosen for, to start afresh for another
    let tab: InfoTab = 'description';
    let tabFor: ArcadeEntry | undefined;
    // The keyboard starts on Play
    const focusPlay = focusOnOpen({
        isOpen: () => bindings.entry() !== undefined,
        target: (layer) => layer.querySelector<HTMLElement>('.info-play') ?? undefined,
    });

    return (
        // The focus step is on a wrapper that is never hidden, so it sees the panel close
        <div class="info-layer" onUpdate={startOnFirstTab} onRefresh={focusPlay}>
            <div
                class={() => (bindings.isOverEntry() ? 'info-backdrop is-over-entry' : 'info-backdrop')}
                visible={() => bindings.entry() !== undefined}
                onClick={(e) => { if (e.target === e.currentTarget) bindings.onClosePressed?.(); }}
            >
                <section class="info-panel" role="dialog" aria-modal="true" aria-labelledby="info-name">
                    <button type="button" class="info-close" aria-label="Close" text="×" onClick={() => bindings.onClosePressed?.()} />
                    <h2 id="info-name" text={() => bindings.entry()?.name ?? ''} />
                    <p class="info-tags" text={() => tagsFor(bindings.entry()?.id)} />
                    <p
                        class="info-inspired"
                        visible={() => bindings.entry()?.inspiredBy !== undefined}
                        text={() => inspirationFor(bindings.entry()?.id)}
                    />
                    {/* The tabs show only where there is more than one */}
                    <div class="info-tabs" role="tablist" aria-label="Info pages" visible={() => isTabShown('how-to-play') || isTabShown('highscores')}>
                        <TabView kind="description" label="Description" />
                        <TabView kind="how-to-play" label="How to Play" />
                        <TabView kind="highscores" label="Highscores" />
                    </div>
                    <div class="info-pages">
                        <div class={() => pageClass('description')} id="info-page-description" role="tabpanel">
                            <p class="info-summary" text={() => bindings.entry()?.summary ?? ''} />
                            <List items={() => paragraphsOf(bindings.details()?.description)}>
                                {(paragraph) => <p class="info-description" text={paragraph} />}
                            </List>
                            <div class="info-section" visible={() => bindings.details()?.implementation !== undefined}>
                                <h3 text="How It's Made" />
                                <List items={() => implementationParagraphsOf(bindings.details()?.implementation)}>
                                    {(paragraph) => <p class="info-description" text={paragraph} />}
                                </List>
                            </div>
                            <div class="info-section" visible={() => techniques().length > 0}>
                                <h3 text="Techniques" />
                                <ul class="info-techniques">
                                    <List items={techniques}>
                                        {(technique) => <li text={technique} />}
                                    </List>
                                </ul>
                            </div>
                            <p class="info-size" text={() => sizeFor(bindings.entry()?.id)} />
                        </div>
                        <div
                            class={() => pageClass('how-to-play')}
                            id="info-page-how-to-play"
                            role="tabpanel"
                            visible={() => isTabShown('how-to-play')}
                        >
                            {HowToPlayView({ howToPlay: () => bindings.details()?.howToPlay })}
                        </div>
                        <div
                            class={() => pageClass('highscores')}
                            id="info-page-highscores"
                            role="tabpanel"
                            visible={() => isTabShown('highscores')}
                        >
                            <HighscoreTableView
                                rows={() => bindings.highscoreRowsFor(bindings.entry()?.id ?? '')}
                                status={bindings.highscoresStatus}
                            />
                        </div>
                    </div>
                    <div class="info-actions">
                        <button type="button" class="info-play" text={() => (bindings.isOverEntry() ? 'Resume' : 'Play')} onClick={play} />
                        <a class="info-source" href={() => sourceFor(bindings.entry()?.id)} target="_blank" text="View source" />
                    </div>
                </section>
            </div>
        </div>
    );

    /**
     * Builds a tab's button. Pressing it shows the tab's page. Only the tab
     * that shows is in the tab order, and Left and Right move between them.
     */
    function TabView({ kind, label }: TabViewBindings): Element {
        return (
            <button
                type="button"
                visible={() => isTabShown(kind)}
                class={() => (shownTab() === kind ? 'info-tab is-selected' : 'info-tab')}
                id={`info-tab-${kind}`}
                role="tab"
                aria-controls={`info-page-${kind}`}
                aria-selected={() => (shownTab() === kind ? 'true' : 'false')}
                text={label}
                onClick={() => { tab = kind; }}
                onKeyDown={moveTab}
                onRefresh={(button) => {
                    const tabIndex = shownTab() === kind ? 0 : -1;
                    if (button.tabIndex !== tabIndex) button.tabIndex = tabIndex;
                }}
            />
        );
    }

    /** Left and Right, on a tab's button, show the tab beside it, round, and move the focus to it. */
    function moveTab(e: KeyboardEvent): void {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const shown = INFO_TABS.filter(isTabShown);
        const step = e.key === 'ArrowRight' ? 1 : -1;
        tab = shown[(shown.indexOf(shownTab()) + step + shown.length) % shown.length];
        const tablist = e.currentTarget instanceof HTMLElement ? e.currentTarget.parentElement : undefined;
        tablist?.querySelector<HTMLElement>(`#info-tab-${tab}`)?.focus();
        e.preventDefault();
    }

    /** Shows the first tab as the panel opens on an entry: How to Play, over the entry, where it has some. */
    function startOnFirstTab(): void {
        const entry = bindings.entry();
        if (entry === tabFor) return;
        tabFor = entry;
        tab = bindings.isOverEntry() && isTabShown('how-to-play') ? 'how-to-play' : 'description';
    }

    /** A page's classes: shown, or not. */
    function pageClass(kind: InfoTab): string {
        return shownTab() === kind ? PAGE_CLASSES[kind].shown : PAGE_CLASSES[kind].hidden;
    }

    /** The tab that shows: the one chosen, or Description, where the entry has none of it. */
    function shownTab(): InfoTab {
        return isTabShown(tab) ? tab : 'description';
    }

    /** Whether the entry has a tab: Description always, How to Play where it says, and Highscores where it keeps a table. */
    function isTabShown(kind: InfoTab): boolean {
        if (kind === 'how-to-play') return bindings.details()?.howToPlay !== undefined;
        if (kind === 'highscores') return bindings.entry()?.hasHighscores === true;
        return true;
    }

    function play(): void {
        const entry = bindings.entry();
        if (entry !== undefined) bindings.onPlayPressed?.(entry.id);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NONE: readonly string[] = [];

/** The panel's tabs. */
type InfoTab = 'description' | 'how-to-play' | 'highscores';

/** Every tab, in the order they show. */
const INFO_TABS: readonly InfoTab[] = ['description', 'how-to-play', 'highscores'];

/** Each page's classes, shown and hidden, made once, so a refresh builds no string. */
const PAGE_CLASSES: Readonly<Record<InfoTab, { readonly shown: string; readonly hidden: string }>> = {
    'description': { shown: 'info-page is-shown', hidden: 'info-page' },
    'how-to-play': { shown: 'info-page is-shown', hidden: 'info-page' },
    'highscores': { shown: 'info-page info-highscores is-shown', hidden: 'info-page info-highscores' },
};

/** What a tab's button shows. */
interface TabViewBindings {
    /** The tab the button shows. */
    readonly kind: InfoTab;
    /** The button's text. */
    readonly label: string;
}

/** "Type: Game · Era: 1980s · ..." for every group the entry has a tag in. */
function describeTags(entry: ArcadeEntry | undefined, factsFor: (id: string) => EntryFacts | undefined): string {
    if (entry === undefined) return '';
    const facts = factsFor(entry.id);
    const parts: string[] = [];
    for (const group of TAG_GROUPS) {
        const values = tagValuesOf(entry, facts, group);
        if (values.length === 0) continue;
        parts.push(`${GROUP_LABELS[group]}: ${values.map((value) => tagLabel({ group, value })).join(', ')}`);
    }
    return parts.join(' · ');
}

/** "Inspired by Pac-Man (Namco, 1980)" */
function describeInspiration(inspiration: Inspiration | undefined): string {
    return inspiration === undefined ? '' : `Inspired by ${inspiration.title} (${inspiration.maker}, ${inspiration.year})`;
}

/** "1.3k lines, 20 files, in src/entries/crumb-chase" */
function describeSize(facts: EntryFacts | undefined): string {
    if (facts === undefined) return '';
    return `${sizeLabel(facts)}, in ${facts.sourcePath.replace(ARCADE_PREFIX, '')}`;
}

const ARCADE_PREFIX = /^packages\/sites\/arcade\//;
