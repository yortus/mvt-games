<script setup lang="ts">
// One of the playground's cheat sheets, by its id, for Appendix G: its
// summary, then each group's entries, each with its name, what it's for, its
// signature, a snippet if it has one, its import line, and the chapter that
// teaches it. The page writes each sheet's heading itself, so the site
// numbers it and lists it as it does every other section. Each group is a
// subsection, numbered from the sheet's own section number, which the site
// passes in (numberHeadings, in book.ts). The sheets are made as the site
// builds, by cheat-sheets.data.ts.
import { computed } from 'vue';
import { withBase } from 'vitepress';
import { toCheatSheetGroupId } from './cheat-sheet-group-id';
import { data as sheets } from './cheat-sheets.data';

const props = defineProps<{
    /** The sheet's id, such as `the-tick`. */
    id: string;
    /** The number of the section the sheet is in, such as `G.2`, to number its groups from. */
    sectionNumber?: string;
}>();

const sheet = computed(() => {
    const found = sheets.find((s) => s.id === props.id);
    if (found === undefined) throw new Error(`There is no cheat sheet with the id '${props.id}'`);
    return found;
});

/** A chapter's address, by its path in the docs, such as `chapters/09-noticing-changes`. */
function toChapterHref(path: string): string {
    return withBase(`/${path}.html`);
}

/** A group's anchor, unique on the page, which the search index uses too. */
function toGroupId(title: string): string {
    return toCheatSheetGroupId(props.id, title);
}

/** Text in parts, so each part in backticks shows as code: the odd parts are code. */
function splitCode(text: string): string[] {
    return text.split('`');
}
</script>

<template>
    <div class="cheat-sheet">
        <p class="cheat-sheet-summary">
            <template v-for="(part, i) in splitCode(sheet.summary)" :key="i">
                <code v-if="i % 2 === 1">{{ part }}</code>
                <template v-else>{{ part }}</template>
            </template>
        </p>
        <p v-if="sheet.moreAt.length > 0" class="cheat-sheet-more">
            More:
            <template v-for="(link, i) in sheet.moreAt" :key="link.url">
                <template v-if="i > 0">, </template>
                <a :href="link.url" target="_blank" rel="noopener">{{ link.label }}</a>
            </template>
        </p>
        <template v-for="(group, groupIndex) in sheet.groups" :key="group.title">
            <h3 :id="toGroupId(group.title)" class="cheat-sheet-group" tabindex="-1">
                <span v-if="sectionNumber !== undefined" class="heading-number">{{ sectionNumber }}.{{ groupIndex + 1 }}</span>
                {{ group.title }}
                <a class="header-anchor" :href="`#${toGroupId(group.title)}`" :aria-label="`Permalink to ${group.title}`">&#8203;</a>
            </h3>
            <div v-for="entry in group.entries" :key="entry.name" class="cheat-entry">
                <p class="cheat-entry-head">
                    <code class="cheat-entry-name">{{ entry.name }}</code>
                    <template v-for="(part, i) in splitCode(entry.useFor)" :key="i">
                        <code v-if="i % 2 === 1">{{ part }}</code>
                        <template v-else>{{ part }}</template>
                    </template>
                </p>
                <pre v-if="entry.signature !== ''" class="cheat-entry-signature"><code>{{ entry.signature }}</code></pre>
                <pre v-if="entry.snippet !== undefined" class="cheat-entry-snippet"><code>{{ entry.snippet }}</code></pre>
                <p v-if="entry.importLine !== undefined || entry.chapter !== undefined" class="cheat-entry-foot">
                    <code v-if="entry.importLine !== undefined">{{ entry.importLine }}</code>
                    <template v-if="entry.importLine !== undefined && entry.chapter !== undefined"> · </template>
                    <a v-if="entry.chapter !== undefined" :href="toChapterHref(entry.chapter.path)">{{ entry.chapter.title }}</a>
                </p>
            </div>
        </template>
    </div>
</template>

<style scoped>
.cheat-sheet-more {
    color: var(--vp-c-text-2);
}

.cheat-sheet-group {
    margin-bottom: 8px;
}

.cheat-entry {
    padding: 8px 0;
    border-top: 1px solid var(--vp-c-divider);
}

.cheat-entry p {
    margin: 4px 0;
}

.cheat-entry-name {
    margin-right: 6px;
    font-weight: 600;
    color: var(--vp-c-brand-1);
}

.cheat-entry pre {
    margin: 6px 0;
    padding: 8px 12px;
    overflow-x: auto;
    border-radius: 6px;
    background: var(--vp-code-block-bg);
    font-size: 13px;
    line-height: 1.5;
}

.cheat-entry-signature {
    color: var(--vp-c-text-2);
}

.cheat-entry-foot {
    font-size: 13px;
    color: var(--vp-c-text-2);
}
</style>
