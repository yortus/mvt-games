/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';
import { memoiseLast } from '@mvtjs/utils';
import type { ArcadeEntry, EntryFacts } from '../../entry-types';
import { TAG_GROUPS, tagValuesOf } from '../models';
import { focusOnOpen } from './focus-on-open';
import { GROUP_LABELS, sizeLabel, SOURCE_ROOT, tagLabel } from './labels';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface EntryInfoViewBindings {
    /** The entry to tell about, or none, when the panel is closed. */
    readonly entry: () => ArcadeEntry | undefined;
    readonly factsFor: (id: string) => EntryFacts | undefined;
    readonly onClosePressed?: () => void;
    readonly onPlayPressed?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An entry's info panel, over the wall: everything the card leaves out. What
 * it is, how to play it, the techniques it shows, its tags (the renderers it
 * draws with among them), its size, and a link to its source.
 */
export function EntryInfoView(bindings: EntryInfoViewBindings): Element {
    // Each is worked out once per entry shown, keyed by the entry's id
    const paragraphsFor = memoiseLast((_id: string | undefined) => bindings.entry()?.description.split('\n\n') ?? NONE);
    const tagsFor = memoiseLast((_id: string | undefined) => describeTags(bindings.entry(), bindings.factsFor));
    const sizeFor = memoiseLast((id: string | undefined) => describeSize(id === undefined ? undefined : bindings.factsFor(id)));
    const sourceFor = memoiseLast((id: string | undefined) => {
        const facts = id === undefined ? undefined : bindings.factsFor(id);
        return facts === undefined ? SOURCE_ROOT : SOURCE_ROOT + facts.sourcePath;
    });
    const techniques = (): readonly string[] => bindings.entry()?.techniques ?? NONE;
    // The keyboard starts on Play
    const focusPlay = focusOnOpen({
        isOpen: () => bindings.entry() !== undefined,
        target: (layer) => layer.querySelector<HTMLElement>('.info-play') ?? undefined,
    });

    return (
        // The focus step is on a wrapper that is never hidden, so it sees the panel close
        <div class="info-layer" onRefresh={focusPlay}>
            <div
                class="info-backdrop"
                visible={() => bindings.entry() !== undefined}
                onClick={(e) => { if (e.target === e.currentTarget) bindings.onClosePressed?.(); }}
            >
                <section class="info-panel" role="dialog" aria-modal="true" aria-labelledby="info-name">
                    <button type="button" class="info-close" aria-label="Close" text="×" onClick={() => bindings.onClosePressed?.()} />
                    <h2 id="info-name" text={() => bindings.entry()?.name ?? ''} />
                    <p class="info-tags" text={() => tagsFor(bindings.entry()?.id)} />
                    <p class="info-summary" text={() => bindings.entry()?.summary ?? ''} />
                    <List items={() => paragraphsFor(bindings.entry()?.id)}>
                        {(paragraph) => <p class="info-description" text={paragraph} />}
                    </List>
                    <div class="info-section" visible={() => bindings.entry()?.instructions !== undefined}>
                        <h3 text="How to play" />
                        <pre class="info-instructions" text={() => bindings.entry()?.instructions ?? ''} />
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
                    <div class="info-actions">
                        <button type="button" class="info-play" text="Play" onClick={play} />
                        <a class="info-source" href={() => sourceFor(bindings.entry()?.id)} target="_blank" text="View source" />
                    </div>
                </section>
            </div>
        </div>
    );

    function play(): void {
        const entry = bindings.entry();
        if (entry !== undefined) bindings.onPlayPressed?.(entry.id);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NONE: readonly string[] = [];

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

/** "1.3k lines, 20 files, in src/entries/crumb-chase" */
function describeSize(facts: EntryFacts | undefined): string {
    if (facts === undefined) return '';
    return `${sizeLabel(facts)}, in ${facts.sourcePath.replace(WEBSITE_PREFIX, '')}`;
}

const WEBSITE_PREFIX = /^packages\/website\//;
