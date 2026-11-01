<script setup lang="ts">
// An example that runs in the page, an experiment: the playground's embed
// page, in an iframe, over a title that numbers it in its chapter, such as
// "Experiment 4A", and names it. Until the reader presses Run, it shows the
// example's still, the image its visual test keeps, so a page with several
// examples starts no renderer until it's asked to. One example runs at a time:
// running another puts this one back to its still, and the page scrolls so
// that the one starting stays where the reader clicked it. A running example
// takes the keyboard, so a game's keys work without a click first: Run moves
// the focus into the embed, and while the focus stays in this page instead,
// the page passes the keys on, until the reader clicks elsewhere in it. When the
// reader opens the editor, below the run, the embed says how tall the editor
// is, and grows by that much. The embed follows the docs' light or dark theme.
// In print, it shows the still and the address of the page online.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';

declare const __SITE_ROOT__: string;
declare const __SITE_ORIGIN__: string;

const props = defineProps<{
    /** The example, by its folder's name in the playground's examples/ or book/. */
    example: string;
    /** The file the editor opens on, if the reader edits, by its path in the example. */
    file?: string;
    /** The run's height, with its bar of controls, in CSS pixels. The editor adds to it. */
    height?: number;
    /** Its number in the book, such as "Experiment 4A", which the docs' Markdown fills in. */
    label?: string;
}>();

const { isDark, page } = useData();
const isRunning = ref(false);
/** Whether the running example takes the keys: from Run, or a click in it, until a click elsewhere in the page. */
const isTakingKeys = ref(false);
/** The editor's height, once the reader has opened it. */
const editorHeight = ref(0);
const frame = ref<HTMLIFrameElement>();
const figure = ref<HTMLElement>();
const still = findStill(props.example);
const name = findName(props.example);
const height = computed(() => `${(props.height ?? DEFAULT_HEIGHT) + editorHeight.value}px`);
const scheme = computed(() => (isDark.value ? 'dark' : 'light'));

const embedUrl = computed(() => {
    const params = new URLSearchParams({ example: props.example });
    if (props.file !== undefined) params.set('file', props.file);
    params.set('theme', scheme.value);
    return `${__SITE_ROOT__}playground/embed.html#${params.toString()}`;
});

const playgroundUrl = `${__SITE_ROOT__}playground/#example=${props.example}`;

/** Where this page is online, for a printed copy to point to. */
const onlineUrl = computed(() => {
    const path = page.value.relativePath.replace(/\.md$/, '.html');
    return `${__SITE_ORIGIN__}${__SITE_ROOT__}docs/${path}`;
});

/** This example's place in the page's running examples. */
const key = Symbol(props.example);

async function run(): Promise<void> {
    // Another example above may close, and shorten the page: this one stays put
    const top = figure.value?.getBoundingClientRect().top;
    running.value = key;
    isRunning.value = true;
    isTakingKeys.value = true;
    await nextTick();
    const moved = top === undefined ? 0 : (figure.value?.getBoundingClientRect().top ?? top) - top;
    if (moved !== 0) window.scrollBy(0, moved);
    // While the Run press still counts as the reader's gesture; the embed's load focuses it again
    frame.value?.focus();
}

// Another example started: back to the still, without the editor
watch(running, (current) => {
    if (current !== key) {
        isRunning.value = false;
        isTakingKeys.value = false;
        editorHeight.value = 0;
    }
});

/** Passes a key pressed in this page on to the running example, while it takes the keys and can be seen. */
function forwardKey(event: KeyboardEvent): void {
    const box = figure.value?.getBoundingClientRect();
    if (!isRunning.value || !isTakingKeys.value || box === undefined) return;
    if (box.bottom < 0 || box.top > window.innerHeight) return;
    // The browser's shortcuts, moving the focus, and typing into a field stay with the page
    if (event.ctrlKey || event.metaKey || event.altKey || event.key === 'Tab') return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]') !== null) return;
    if (SCROLLING_KEYS.includes(event.key)) event.preventDefault();
    const { key, code, repeat, shiftKey, ctrlKey, altKey, metaKey } = event;
    frame.value?.contentWindow?.postMessage({ kind: 'key', key: { type: event.type, key, code, repeat, shiftKey, ctrlKey, altKey, metaKey } }, '*');
}

/** A click in the example gives it the keys, and a click elsewhere in the page takes them back. */
function takeKeysOnClick(event: PointerEvent): void {
    isTakingKeys.value = event.target instanceof Node && figure.value?.contains(event.target) === true;
}

/** A click inside the running example moves the focus into it, out of this page, which gives it the keys too. */
function takeKeysOnFocus(): void {
    if (frame.value !== undefined && document.activeElement === frame.value) isTakingKeys.value = true;
}

/** Grows the embed by the editor's height as the reader opens it. */
function readEditingMessage(event: MessageEvent<unknown>): void {
    if (frame.value === undefined || event.source !== frame.value.contentWindow) return;
    const message = event.data as { readonly kind?: unknown; readonly editorHeight?: unknown } | undefined;
    if (message?.kind === 'editing' && typeof message.editorHeight === 'number') editorHeight.value = message.editorHeight;
}

onMounted(() => {
    window.addEventListener('message', readEditingMessage);
    window.addEventListener('keydown', forwardKey);
    window.addEventListener('keyup', forwardKey);
    window.addEventListener('pointerdown', takeKeysOnClick);
    window.addEventListener('blur', takeKeysOnFocus);
});

// The embed matches the docs' theme as the reader changes it
watch(scheme, (current) => {
    frame.value?.contentWindow?.postMessage({ kind: 'set-theme', scheme: current }, '*');
});

onBeforeUnmount(() => {
    window.removeEventListener('message', readEditingMessage);
    window.removeEventListener('keydown', forwardKey);
    window.removeEventListener('keyup', forwardKey);
    window.removeEventListener('pointerdown', takeKeysOnClick);
    window.removeEventListener('blur', takeKeysOnFocus);
    if (running.value === key) running.value = undefined;
});
</script>

<script lang="ts">
import { ref as sharedRef } from 'vue';

/**
 * Each example's still, by its path, from the playground's visual tests:
 * `examples.<id>.png` for the playground's examples, `book.<id>.png` for the
 * book's.
 */
const STILLS = import.meta.glob<string>(
    '../../../playground/src/examples/visual-tests/{examples,book}.*.png',
    { eager: true, query: '?url', import: 'default' },
);
const STILLS_DIR = '../../../playground/src/examples/visual-tests';

/** Each example's name, by the path of its `example.ts`, in the playground's examples/ or book/. */
const INFOS = import.meta.glob<{ readonly name: string }>(
    '../../../playground/{examples,book}/*/example.ts',
    { eager: true, import: 'example' },
);

const DEFAULT_HEIGHT = 420;

/** Keys that scroll a page, which a game uses too. */
const SCROLLING_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown', 'Home', 'End'];

function findStill(example: string): string | undefined {
    return STILLS[`${STILLS_DIR}/book.${example}.png`] ?? STILLS[`${STILLS_DIR}/examples.${example}.png`];
}

function findName(example: string): string {
    const info = INFOS[`../../../playground/book/${example}/example.ts`] ?? INFOS[`../../../playground/examples/${example}/example.ts`];
    return info?.name ?? example;
}

/** The example running in the page now, if any. Shared by every TryIt on the page. */
const running = sharedRef<symbol | undefined>(undefined);
</script>

<template>
    <figure :id="`try-${example}`" ref="figure" class="try-it">
        <div class="try-it-box" :class="{ 'is-taking-keys': isRunning && isTakingKeys }" :style="{ height }">
            <iframe
                v-if="isRunning"
                ref="frame"
                class="try-it-frame"
                :src="embedUrl"
                :title="`${label ?? 'The example'}, ${name}, running`"
                allow="autoplay"
                @load="frame?.focus()"
            />
            <button v-else type="button" class="try-it-still" :aria-label="`Run ${label ?? 'the example'}, ${name}, here`" @click="run">
                <img v-if="still" :src="still" alt="" class="try-it-image" />
                <span class="try-it-run">Run it here</span>
            </button>
        </div>
        <img v-if="still" :src="still" alt="" class="try-it-print-image" />
        <figcaption class="try-it-foot">
            <span class="try-it-title">
                <span v-if="label" class="try-it-label">{{ label }}</span>
                <span class="try-it-name">{{ name }}</span>
            </span>
            <span class="try-it-caption">
                <a :href="playgroundUrl" target="_blank" rel="noopener">Open it in the playground</a>
                <span class="try-it-print">Run it, and change it, online: {{ onlineUrl }}</span>
            </span>
        </figcaption>
    </figure>
</template>

<style scoped>
.try-it {
    margin: 16px 0;
}

/* Under the run: its number and name on the left, the playground's link on the right */
.try-it-foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: 4px 16px;
    margin-top: 6px;
}

.try-it-title {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: 15px;
}

.try-it-label {
    font-weight: 700;
    color: var(--vp-c-brand-1);
}

.try-it-name {
    font-weight: 600;
}

.try-it-box {
    position: relative;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    overflow: hidden;
    background: #0d1117;
}

/* The example the keys go to */
.try-it-box.is-taking-keys {
    border-color: var(--vp-c-brand-1);
    box-shadow: 0 0 0 1px var(--vp-c-brand-1);
}

.try-it-frame {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
}

.try-it-still {
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    position: relative;
    display: grid;
    place-items: center;
}

.try-it-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.try-it-run {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    padding: 8px 16px;
    border-radius: 20px;
    background: var(--vp-c-brand-1);
    color: var(--vp-c-white);
    font-weight: 600;
}

.try-it-still:hover .try-it-run,
.try-it-still:focus-visible .try-it-run {
    background: var(--vp-c-brand-2);
}

.try-it-caption {
    font-size: 14px;
    color: var(--vp-c-text-2);
}

.try-it-print,
.try-it-print-image {
    display: none;
}

/* On paper, nothing runs: the still, and where to try it, whether or not
   the example was running when the page was printed */
@media print {
    .try-it-box,
    .try-it-caption a {
        display: none;
    }

    .try-it-print-image {
        display: block;
        max-width: 100%;
        max-height: 60mm;
        margin: 0 auto;
    }

    .try-it-print {
        display: inline;
    }
}
</style>
